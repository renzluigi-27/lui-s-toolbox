/* ─────────────────────────────────────────────────────────────────
   PAYOUT AUDITOR — Toolbox by Renz Luigi
   Self-contained module. Requires SheetJS (global XLSX) already loaded.
   Usage:  PayoutAuditor.init(mountElement)
   Compares the Payout Generator output against the Accounts list.
   No recompute — values compared as-is.
───────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var XLSX = window.XLSX;

  /* ── state ── */
  var files = { gen: null, acc: null, info: null };
  var lastWorkbook = null;   // generated audit workbook (for download)
  var lastFilename = 'PAYOUT_AUDIT.xlsx';
  var mount = null;

  /* ════════════════════════════════════════════
     HELPERS — normalization
     ════════════════════════════════════════════ */

  var HONORIFICS = /^(mr|mrs|ms|miss|dr)\.?\s+/i;

  function normName(raw) {
    if (raw == null) return '';
    var s = String(raw).toLowerCase().trim();
    s = s.replace(/\(.*?\)/g, ' ');          // drop parentheticals
    s = s.split('/')[0];                     // take first before slash
    var prev;
    do { prev = s; s = s.replace(HONORIFICS, ''); } while (s !== prev);
    s = s.replace(/[^a-z\s]/g, ' ');         // keep letters + space
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  // Name keys in priority order: inside-paren → outside-paren → full raw
  function nameKeys(raw) {
    if (raw == null) return [];
    var str = String(raw);
    var keys = [];
    var m = str.match(/\(([^)]*)\)/);
    if (m && m[1].trim()) keys.push(normName(m[1]));
    var outside = str.replace(/\(.*?\)/g, ' ').trim();
    if (outside) keys.push(normName(outside));
    keys.push(normName(str));
    // de-dupe, drop empties
    var seen = {}, out = [];
    keys.forEach(function (k) { if (k && !seen[k]) { seen[k] = 1; out.push(k); } });
    return out;
  }

  function normAccount(v) {
    if (v == null) return '';
    return String(v).replace(/\s+/g, '').replace(/^0+/, '');
  }
  function normIBAN(v) {
    if (v == null) return '';
    return String(v).toUpperCase().replace(/\s+/g, '');
  }
  function toNum(v) {
    if (v == null || v === '') return 0;
    var n = parseFloat(String(v).replace(/[,\s]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  function numsEqual(a, b) { return Math.abs(toNum(a) - toNum(b)) < 0.005; }
  function isPaid(rowVals) {
    return rowVals.some(function (c) {
      return c != null && /\bpaid\b/i.test(String(c));
    });
  }

  // precision = same length, differ only in last 1-2 chars
  function diffIsPrecision(a, b) {
    if (a.length !== b.length || a.length < 3) return false;
    var head = a.length - 2;
    return a.slice(0, head) === b.slice(0, head);
  }

  /* ── fuzzy: token_sort_ratio (Indel/LCS based, ~rapidfuzz) ── */
  function lcsLen(a, b) {
    var m = a.length, n = b.length;
    if (!m || !n) return 0;
    var prev = new Array(n + 1).fill(0), cur = new Array(n + 1).fill(0);
    for (var i = 1; i <= m; i++) {
      for (var j = 1; j <= n; j++) {
        cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }
  function sortTokens(s) { return s.split(' ').filter(Boolean).sort().join(' '); }
  function tokenSortRatio(a, b) {
    var s1 = sortTokens(a), s2 = sortTokens(b);
    if (!s1.length && !s2.length) return 100;
    if (!s1.length || !s2.length) return 0;
    return (2 * lcsLen(s1, s2) / (s1.length + s2.length)) * 100;
  }

  /* ════════════════════════════════════════════
     HELPERS — workbook parsing
     ════════════════════════════════════════════ */

  function readWorkbook(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function (e) {
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: false });
          resolve(wb);
        } catch (err) { reject(err); }
      };
      r.onerror = function () { reject(new Error('read failed')); };
      r.readAsArrayBuffer(file);
    });
  }

  // expand merged cells (top-left value into the whole range) then return AOA
  function sheetToAOA(ws) {
    if (ws['!merges']) {
      ws['!merges'].forEach(function (mg) {
        var top = XLSX.utils.encode_cell({ r: mg.s.r, c: mg.s.c });
        var val = ws[top] ? ws[top].v : undefined;
        if (val === undefined) return;
        for (var R = mg.s.r; R <= mg.e.r; R++) {
          for (var C = mg.s.c; C <= mg.e.c; C++) {
            var addr = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[addr]) ws[addr] = { t: 's', v: val };
          }
        }
      });
    }
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
  }

  function normHeader(h) {
    return String(h == null ? '' : h).toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  }

  var SYN = {
    clientType: ['client type'],
    name:       ['client name', 'name'],
    unit:       ['unit'],
    firstPayout:['first payout', 'first payout date'],
    rent:       ['monthly rent', 'monthly rental', 'rent', 'rental'],
    deduction:  ['deduction'],
    addition:   ['addition'],
    rentalDue:  ['rental due', 'due'],
    account:    ['account no', 'account number', 'account', 'acc no'],
    iban:       ['iban no', 'iban', 'iban number'],
    notes:      ['notes', 'remarks']
  };

  // find header row index + map field->colIndex
  function mapHeaders(aoa) {
    var headerRowIdx = -1, map = {};
    for (var i = 0; i < Math.min(aoa.length, 10); i++) {
      var row = aoa[i] || [];
      var norm = row.map(normHeader);
      if (norm.indexOf('client name') > -1 || norm.indexOf('monthly rental') > -1 || norm.indexOf('rental due') > -1) {
        headerRowIdx = i;
        Object.keys(SYN).forEach(function (field) {
          for (var c = 0; c < norm.length; c++) {
            if (SYN[field].indexOf(norm[c]) > -1) { map[field] = c; break; }
          }
        });
        break;
      }
    }
    return { headerRowIdx: headerRowIdx, map: map };
  }

  // parse one sheet into row objects (only fields we need)
  function parseSheet(ws) {
    var aoa = sheetToAOA(ws);
    var hm = mapHeaders(aoa);
    if (hm.headerRowIdx < 0) return [];
    var rows = [];
    for (var i = hm.headerRowIdx + 1; i < aoa.length; i++) {
      var raw = aoa[i] || [];
      if (!raw.some(function (c) { return c != null && String(c).trim() !== ''; })) continue;
      function g(field) { var c = hm.map[field]; return c == null ? null : raw[c]; }
      rows.push({
        name: g('name'),
        rent: g('rent'),
        deduction: g('deduction'),
        addition: g('addition'),
        rentalDue: g('rentalDue'),
        account: g('account'),
        iban: g('iban'),
        _raw: raw
      });
    }
    return rows;
  }

  // accounts file → combine all sheets that look like client lists
  function parseAccounts(wb) {
    var all = [];
    wb.SheetNames.forEach(function (sn) {
      var rows = parseSheet(wb.Sheets[sn]);
      rows.forEach(function (r) { r._sheet = sn; });
      all = all.concat(rows);
    });
    return all;
  }

  // updated payment info sheet → name → {restart, cycle}
  function parseInfo(wb) {
    var ws = wb.Sheets[wb.SheetNames[0]];
    var aoa = sheetToAOA(ws);
    if (!aoa.length) return [];
    var header = (aoa[0] || []).map(normHeader);
    function col() {
      for (var a = 0; a < arguments.length; a++) {
        var idx = header.indexOf(arguments[a]);
        if (idx > -1) return idx;
      }
      return -1;
    }
    var cName = col('client name', 'name');
    var cRestart = -1, cCycle = -1;
    for (var c = 0; c < header.length; c++) {
      if (cRestart < 0 && header[c].indexOf('restart') > -1) cRestart = c;
      if (cCycle < 0 && header[c].indexOf('cycle') > -1) cCycle = c;
    }
    var out = [];
    for (var i = 1; i < aoa.length; i++) {
      var row = aoa[i] || [];
      if (cName < 0 || row[cName] == null) continue;
      out.push({ name: row[cName], restart: cRestart > -1 ? row[cRestart] : null, cycle: cCycle > -1 ? row[cCycle] : null });
    }
    return out;
  }

  /* ════════════════════════════════════════════
     MATCHING
     ════════════════════════════════════════════ */

  // build lookup: key → array of records, plus flat list for fuzzy
  function buildIndex(records) {
    var byKey = {}, flat = [];
    records.forEach(function (rec) {
      rec._keys = nameKeys(rec.name);
      rec._norm = rec._keys[rec._keys.length - 1] || '';
      flat.push(rec);
      rec._keys.forEach(function (k) { if (!byKey[k]) byKey[k] = rec; });
    });
    return { byKey: byKey, flat: flat };
  }

  function findMatch(srcRow, index) {
    var keys = nameKeys(srcRow.name);
    for (var i = 0; i < keys.length; i++) {
      if (index.byKey[keys[i]]) return index.byKey[keys[i]];
    }
    // fuzzy fallback
    var src = keys[keys.length - 1] || '';
    var best = null, bestScore = 0;
    index.flat.forEach(function (rec) {
      var sc = tokenSortRatio(src, rec._norm);
      if (sc > bestScore) { bestScore = sc; best = rec; }
    });
    return bestScore >= 88 ? best : null;
  }

  /* ════════════════════════════════════════════
     REASON TAGGING (in accounts, not in mine)
     ════════════════════════════════════════════ */

  function parseDMY(v) {
    if (v == null) return null;
    if (typeof v === 'number') { // excel serial
      var d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return { d: d.getUTCDate(), m: d.getUTCMonth() + 1, y: d.getUTCFullYear() };
    }
    var s = String(v).trim();
    var m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (!m) return null;
    var yr = parseInt(m[3], 10); if (yr < 100) yr += 2000;
    return { d: parseInt(m[1], 10), m: parseInt(m[2], 10), y: yr };
  }

  function tagReason(accRow, infoIndex, period) {
    var rec = findMatch(accRow, infoIndex);
    if (!rec) return 'Not found in payment info sheet — review';
    var rst = parseDMY(rec.restart);
    var cyc = rec.cycle != null ? rec.cycle : '?';
    if (!rst) return 'In info sheet (cycle ' + cyc + '); restart date unreadable — review';
    var ds = String(rst.d).padStart(2, '0') + '/' + String(rst.m).padStart(2, '0') + '/' + rst.y;
    if (rst.d === 31 && rst.m === 5) return 'Expected May 31 reschedule (restart ' + ds + ', cycle ' + cyc + ')';
    if (period && (rst.y > period.y || (rst.y === period.y && rst.m > period.m))) {
      return 'Restart ' + ds + ', cycle ' + cyc + ' — belongs to later cycle';
    }
    return 'Restart ' + ds + ', cycle ' + cyc + ' — review';
  }

  /* ════════════════════════════════════════════
     PERIOD / FILENAME (from generator file name)
     ════════════════════════════════════════════ */

  var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  function derivePeriod(genFileName, genWb) {
    // PAYOUT_15_JUN2026.xlsx  → {token:'JUN2026', m, y}
    var m = (genFileName || '').match(/PAYOUT[_\- ]*\d{1,2}[_\- ]*([A-Za-z]{3})[A-Za-z]*[_\- ]*(\d{4})/i);
    if (!m) {
      // fallback: sheet tab name e.g. "Jun 2026 - 15th"
      var sn = genWb ? genWb.SheetNames[0] : '';
      m = sn.match(/([A-Za-z]{3})[A-Za-z]*\s*(\d{4})/);
    }
    if (!m) return null;
    var mon = m[1].toUpperCase().slice(0, 3);
    var mi = MONTHS.indexOf(mon);
    if (mi < 0) return null;
    return { token: mon + m[2], m: mi + 1, y: parseInt(m[2], 10) };
  }

  /* ════════════════════════════════════════════
     CORE AUDIT
     ════════════════════════════════════════════ */

  function runAudit() {
    return Promise.all([
      readWorkbook(files.gen),
      readWorkbook(files.acc),
      readWorkbook(files.info)
    ]).then(function (wbs) {
      var genWb = wbs[0], accWb = wbs[1], infoWb = wbs[2];

      var genRows = parseSheet(genWb.Sheets[genWb.SheetNames[0]]);
      var accRows = parseAccounts(accWb);
      var infoRows = parseInfo(infoWb);

      var period = derivePeriod(files.gen.name, genWb);

      var accIndex = buildIndex(accRows);
      var infoIndex = buildIndex(infoRows);

      var sections = {
        rent: [], deduction: [], addition: [], rentalDue: [],
        acctPrecision: [], acctMaterial: [],
        ibanPrecision: [], ibanMaterial: [],
        mineNotInAcc: [], accNotInMine: []
      };

      var matchedAcc = {};   // track which accounts rows got matched
      var matchedCount = 0;

      genRows.forEach(function (g) {
        if (isPaid(g._raw)) return;
        var a = findMatch(g, accIndex);
        if (!a) { sections.mineNotInAcc.push(g); return; }
        matchedAcc[accRows.indexOf(a)] = true;
        matchedCount++;

        var client = String(g.name || '').trim();
        if (!numsEqual(g.rent, a.rent))           sections.rent.push([client, toNum(a.rent), toNum(g.rent)]);
        if (!numsEqual(g.deduction, a.deduction)) sections.deduction.push([client, toNum(a.deduction), toNum(g.deduction)]);
        if (!numsEqual(g.addition, a.addition))   sections.addition.push([client, toNum(a.addition), toNum(g.addition)]);
        if (!numsEqual(g.rentalDue, a.rentalDue)) sections.rentalDue.push([client, toNum(a.rentalDue), toNum(g.rentalDue)]);

        var gAcc = normAccount(g.account), aAcc = normAccount(a.account);
        if (gAcc !== aAcc) {
          var row = [client, String(a.account == null ? '' : a.account), String(g.account == null ? '' : g.account)];
          if (diffIsPrecision(gAcc, aAcc)) sections.acctPrecision.push(row);
          else sections.acctMaterial.push(row);
        }
        var gIb = normIBAN(g.iban), aIb = normIBAN(a.iban);
        if (gIb !== aIb) {
          var irow = [client, String(a.iban == null ? '' : a.iban), String(g.iban == null ? '' : g.iban)];
          if (diffIsPrecision(gIb, aIb)) sections.ibanPrecision.push(irow);
          else sections.ibanMaterial.push(irow);
        }
      });

      // accounts rows never matched
      accRows.forEach(function (a, idx) {
        if (matchedAcc[idx]) return;
        if (isPaid(a._raw)) return;
        sections.accNotInMine.push([String(a.name || '').trim(), tagReason(a, infoIndex, period)]);
      });

      var diffTotal = sections.rent.length + sections.deduction.length + sections.addition.length +
        sections.rentalDue.length + sections.acctPrecision.length + sections.acctMaterial.length +
        sections.ibanPrecision.length + sections.ibanMaterial.length;

      var summary = {
        matched: matchedCount,
        differences: diffTotal,
        mineOnly: sections.mineNotInAcc.length,
        accOnly: sections.accNotInMine.length
      };

      lastFilename = 'PAYOUT_AUDIT_' + (period ? period.token : 'OUTPUT') + '.xlsx';
      lastWorkbook = buildWorkbook(sections, summary, period);
      return { sections: sections, summary: summary, period: period };
    });
  }

  /* ════════════════════════════════════════════
     BUILD XLSX (single sheet, stacked sections)
     ════════════════════════════════════════════ */

  function buildWorkbook(s, summary, period) {
    var aoa = [];
    aoa.push(['PAYOUT AUDIT' + (period ? ' — ' + period.token : '')]);
    aoa.push([]);
    aoa.push(['SUMMARY']);
    aoa.push(['Matched', summary.matched]);
    aoa.push(['Differences', summary.differences]);
    aoa.push(['Mine not in accounts', summary.mineOnly]);
    aoa.push(['In accounts, not in mine', summary.accOnly]);
    aoa.push([]);

    function block(title, header, rows) {
      aoa.push([title + ' (' + rows.length + ')']);
      if (rows.length) {
        aoa.push(header);
        rows.forEach(function (r) { aoa.push(r); });
      } else {
        aoa.push(['— none —']);
      }
      aoa.push([]);
    }

    var diffHdr = ['Client', 'Accounts value', 'My value'];
    block('MONTHLY RENTAL DIFFERENCES', diffHdr, s.rent);
    block('DEDUCTION DIFFERENCES', diffHdr, s.deduction);
    block('ADDITION DIFFERENCES', diffHdr, s.addition);
    block('RENTAL DUE DIFFERENCES', diffHdr, s.rentalDue);
    block('ACCOUNT NO — PRECISION-TYPE (low priority)', diffHdr, s.acctPrecision);
    block('ACCOUNT NO — MATERIALLY DIFFERENT (review)', diffHdr, s.acctMaterial);
    block('IBAN — PRECISION-TYPE (low priority)', diffHdr, s.ibanPrecision);
    block('IBAN — MATERIALLY DIFFERENT (review)', diffHdr, s.ibanMaterial);

    block('MINE NOT IN ACCOUNTS (review)', ['Client', 'Account No', 'IBAN', 'Rental Due'],
      s.mineNotInAcc.map(function (g) {
        return [String(g.name || '').trim(), String(g.account == null ? '' : g.account),
                String(g.iban == null ? '' : g.iban), toNum(g.rentalDue)];
      }));

    block('IN ACCOUNTS, NOT IN MINE', ['Client', 'Reason'], s.accNotInMine);

    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 42 }, { wch: 30 }, { wch: 30 }, { wch: 14 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payout Audit');
    return wb;
  }

  /* ════════════════════════════════════════════
     UI
     ════════════════════════════════════════════ */

  function uploadCard(id, label, optional, hint) {
    return '' +
    '<div class="card">' +
      '<div class="section-label">' + label +
        (optional ? ' <span class="optional-label">' + optional + '</span>' : '') + '</div>' +
      '<div class="upload-zone upload-zone-sm" id="' + id + '-zone">' +
        '<input type="file" accept=".xlsx,.xls" id="' + id + '-input" />' +
        '<div class="upload-zone-text"><strong>Click to upload or drag &amp; drop</strong>' + hint + '</div>' +
      '</div>' +
      '<div class="file-loaded" id="' + id + '-loaded">' +
        '<span class="file-loaded-name"></span><span class="file-loaded-meta"></span></div>' +
    '</div>';
  }

  function render() {
    mount.innerHTML = '' +
      uploadCard('pa-gen',  'Payout Generator', '', 'Sets the filename · .xlsx') +
      uploadCard('pa-acc',  'Accounts List', '', 'LOCAL + INTERNATIONAL auto-combined · .xlsx') +
      uploadCard('pa-info', 'Updated Payment Info Sheet', '', 'Reason tagging (cycle + restart) · .xlsx') +
      '<div class="card">' +
        '<button class="btn-primary" id="pa-run" style="width:100%;justify-content:center;" disabled>Run audit</button>' +
        '<button class="btn-primary" id="pa-dl" style="width:100%;justify-content:center;margin-top:8px;" disabled>Download audit file</button>' +
        '<div class="msg" id="pa-msg"></div>' +
      '</div>' +
      '<div id="pa-results"></div>';

    bindUpload('pa-gen', 'gen');
    bindUpload('pa-acc', 'acc');
    bindUpload('pa-info', 'info');

    document.getElementById('pa-run').addEventListener('click', onRun);
    document.getElementById('pa-dl').addEventListener('click', onDownload);
  }

  function bindUpload(id, key) {
    var input = document.getElementById(id + '-input');
    var zone = document.getElementById(id + '-zone');
    var loaded = document.getElementById(id + '-loaded');
    function set(file) {
      files[key] = file;
      loaded.querySelector('.file-loaded-name').textContent = file.name;
      loaded.querySelector('.file-loaded-meta').textContent = (file.size / 1024).toFixed(0) + ' KB';
      loaded.classList.add('show');
      refreshRunState();
    }
    input.addEventListener('change', function () { if (input.files[0]) set(input.files[0]); });
    ['dragover', 'dragenter'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('dragover'); });
    });
    zone.addEventListener('drop', function (e) {
      if (e.dataTransfer.files[0]) { input.files = e.dataTransfer.files; set(e.dataTransfer.files[0]); }
    });
  }

  function refreshRunState() {
    document.getElementById('pa-run').disabled = !(files.gen && files.acc && files.info);
  }

  function showMsg(text, kind) {
    var el = document.getElementById('pa-msg');
    el.className = 'msg show ' + (kind || 'info');
    el.textContent = text;
  }

  function onRun() {
    showMsg('Auditing…', 'info');
    document.getElementById('pa-run').disabled = true;
    runAudit().then(function (res) {
      renderResults(res);
      document.getElementById('pa-dl').disabled = false;
      showMsg('Done. ' + lastFilename + ' ready to download.', 'info');
      document.getElementById('pa-run').disabled = false;
    }).catch(function (err) {
      console.error(err);
      showMsg('Error: ' + err.message, 'error');
      document.getElementById('pa-run').disabled = false;
    });
  }

  function onDownload() {
    if (!lastWorkbook) return;
    XLSX.writeFile(lastWorkbook, lastFilename);
  }

  function table(headers, rows) {
    var h = '<div class="table-wrap"><table><thead><tr>' +
      headers.map(function (x) { return '<th>' + x + '</th>'; }).join('') +
      '</tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr>' + r.map(function (c, i) {
        var cls = i === 0 ? 'td-name' : 'td-num';
        return '<td class="' + cls + '">' + (c == null ? '' : String(c)) + '</td>';
      }).join('') + '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  function group(title, headers, rows) {
    if (!rows.length) return '';
    return '<div class="card"><div class="results-header"><span class="results-title">' +
      title + ' (' + rows.length + ')</span></div>' + table(headers, rows) + '</div>';
  }

  function renderResults(res) {
    var s = res.sections, sm = res.summary;
    var html = '<div class="card"><div class="stats-grid">' +
      statBox(sm.matched, 'Matched') +
      statBox(sm.differences, 'Differences') +
      statBox(sm.mineOnly, 'Mine only') +
      statBox(sm.accOnly, 'Accounts only') +
      '</div></div>';

    var diffHdr = ['Client', 'Accounts', 'Mine'];
    html += group('Monthly Rental differences', diffHdr, s.rent);
    html += group('Deduction differences', diffHdr, s.deduction);
    html += group('Addition differences', diffHdr, s.addition);
    html += group('Rental Due differences', diffHdr, s.rentalDue);
    html += group('Account No — precision-type', diffHdr, s.acctPrecision);
    html += group('Account No — materially different', diffHdr, s.acctMaterial);
    html += group('IBAN — precision-type', diffHdr, s.ibanPrecision);
    html += group('IBAN — materially different', diffHdr, s.ibanMaterial);
    html += group('Mine not in accounts', ['Client', 'Account No', 'IBAN', 'Rental Due'],
      s.mineNotInAcc.map(function (g) {
        return [String(g.name || '').trim(), String(g.account == null ? '' : g.account),
                String(g.iban == null ? '' : g.iban), toNum(g.rentalDue)];
      }));
    html += group('In accounts, not in mine', ['Client', 'Reason'], s.accNotInMine);

    document.getElementById('pa-results').innerHTML = html;
  }

  function statBox(val, lbl) {
    return '<div class="stat-box"><span class="stat-val">' + val + '</span><span class="stat-lbl">' + lbl + '</span></div>';
  }

  /* ── public ── */
  window.PayoutAuditor = {
    init: function (el) {
      mount = (typeof el === 'string') ? document.getElementById(el) : el;
      if (!mount) { console.error('PayoutAuditor: mount element not found'); return; }
      XLSX = window.XLSX;
      render();
    }
  };
})();
