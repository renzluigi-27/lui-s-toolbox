/* ─────────────────────────────────────────────────────────────────
   PAYOUT AUDITOR — Toolbox by Renz Luigi
   Self-contained module. Requires SheetJS (global XLSX) for reading
   uploaded files, and ExcelJS (global ExcelJS) for writing the audit
   output — SheetJS's free build can't write cell fill colors, so the
   highlighted output uses ExcelJS instead.
   Also requires shared.js + app.js loaded first (uses global
   parsePaymentSheet() and filterRowsForCycle() so the Payment Info
   Sheet is parsed with the exact same rules as the Payout Generator —
   single source of truth, no logic drift).
   Usage:  PayoutAuditor.init(mountElement)

   Compares: Generated Payout vs Accounts List vs Payment Info Sheet.
   No recompute — values compared as-is. Both Gen and Acct sides are
   aggregated per payee first (a client with several containers = one
   payee). Payment Info Sheet rental is summed per client using the
   same rerouted/non-rerouted rule as the generator:
     - rerouted client     -> Revised Rental Income [LMC]
     - non-rerouted client -> Return amount
───────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var XLSX = window.XLSX;

  /* ── state ── */
  var files = { gen: null, acc: null, info: null };
  var lastWb = null;          // ExcelJS workbook
  var lastFilename = 'PAYOUT_AUDIT.xlsx';
  var mount = null;

  var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  var COLOR_HEADER1 = 'FF2F5597';   // dark blue — top header row
  var COLOR_HEADER2 = 'FF4472C4';   // lighter blue — sub-header row
  var COLOR_DIFF     = 'FFFFF2CC';  // pale yellow — highlighted diff cells

  /* ════════════════════════════════════════════
     HELPERS — normalization
     ════════════════════════════════════════════ */

  var HONORIFICS = /^(mr|mrs|ms|miss|dr)\.?\s+/i;

  function normName(raw) {
    if (raw == null) return '';
    var s = String(raw).toLowerCase().trim();
    s = s.replace(/\(.*?\)/g, ' ');
    s = s.split('/')[0];
    var prev;
    do { prev = s; s = s.replace(HONORIFICS, ''); } while (s !== prev);
    s = s.replace(/[^a-z\s]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function nameKeys(raw) {
    if (raw == null) return [];
    var str = String(raw);
    var keys = [];
    var m = str.match(/\(([^)]*)\)/);
    if (m && m[1].trim()) keys.push(normName(m[1]));
    var outside = str.replace(/\(.*?\)/g, ' ').trim();
    if (outside) keys.push(normName(outside));
    keys.push(normName(str));
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
      if (c == null) return false;
      var s = String(c).trim();
      return /^paid\b/i.test(s);
    });
  }

  // Only Excel's 15-significant-digit rounding of a long (16+ digit) number
  // counts as "same". Short numbers: any difference is a real typo.
  function isRoundingOnly(a, b) {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    if (a.length <= 15) return false;
    return a.slice(0, 15) === b.slice(0, 15);
  }

  /* ── bank identifier: IBAN if present, else Account + SWIFT ── */
  function bankKey(e) {
    var iban = e && e.iban ? normIBAN(e.iban) : '';
    if (iban) return 'IBAN:' + iban;
    var acc = normAccount(e && e.account);
    var sw = e && e.swift ? String(e.swift).toUpperCase().replace(/\s+/g, '') : '';
    return 'ACC:' + acc + '|' + sw;
  }
  function bankDisplay(e) {
    if (!e) return '';
    if (e.iban && String(e.iban).trim()) return String(e.iban).trim();
    var parts = [];
    if (e.account) parts.push(String(e.account).trim());
    if (e.swift) parts.push(String(e.swift).trim());
    return parts.join(' · ');
  }
  function bankDiffers(a, b) {
    if (!a || !b) return false;
    var ka = bankKey(a), kb = bankKey(b);
    if (ka === kb) return false;
    if (!(a.iban && String(a.iban).trim()) && !(b.iban && String(b.iban).trim())) {
      var accA = normAccount(a.account), accB = normAccount(b.account);
      if (isRoundingOnly(accA, accB)) return false;
    }
    return true;
  }

  /* ── grouping key: IBAN first, then account no., then name — matches how
     the Payout Generator itself groups payees, so clients sharing one bank
     account (2-3 people on the same IBAN) aggregate together correctly
     instead of showing as separate false-diff rows. ── */
  function groupKey(iban, account, nameKey) {
    var ib = normIBAN(iban);
    if (ib) return 'IBAN:' + ib;
    var acc = normAccount(account);
    if (acc) return 'ACC:' + acc;
    return 'NAME:' + nameKey;
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
     WORKBOOK READING (SheetJS — input files only)
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

  // Must match app.js's readExcel exactly (cellDates:true, raw:false)
  // so global parsePaymentSheet() parses it the same way the Payout
  // Generator does.
  function readPIRows(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function (e) {
        try {
          var wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
          resolve(rows);
        } catch (err) { reject(err); }
      };
      r.onerror = function () { reject(new Error('read failed')); };
      r.readAsArrayBuffer(file);
    });
  }

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
    name:       ['client name', 'name'],
    rent:       ['monthly rent', 'monthly rental', 'rent', 'rental', 'new rental'],
    deduction:  ['deduction'],
    addition:   ['addition'],
    rentalDue:  ['rental due', 'due', 'rental amount'],
    account:    ['account no', 'account number', 'account', 'acc no'],
    iban:       ['iban no', 'iban', 'iban number'],
    swift:      ['swift code', 'swift']
  };

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
        swift: g('swift'),
        _raw: raw
      });
    }
    return rows;
  }

  function parseAccounts(wb) {
    var all = [];
    wb.SheetNames.forEach(function (sn) {
      parseSheet(wb.Sheets[sn]).forEach(function (r) { all.push(r); });
    });
    return all;
  }

  /* ════════════════════════════════════════════
     AGGREGATE per payee — Gen / Accounts side
     ════════════════════════════════════════════ */

  function aggregate(rows) {
    var map = {}, order = [];
    rows.forEach(function (r) {
      if (isPaid(r._raw)) return;
      var disp = String(r.name == null ? '' : r.name).trim();
      if (!disp || /^total$/i.test(disp)) return;
      var nameKey = normName(r.name);
      if (!nameKey) return;
      var key = groupKey(r.iban, r.account, nameKey);
      if (!map[key]) {
        map[key] = {
          name: disp, rent: 0, deduction: 0, addition: 0, rentalDue: 0,
          account: null, iban: null, swift: null,
          _keys: nameKeys(r.name), _norm: nameKey, _names: {}
        };
        order.push(key);
      }
      var g = map[key];
      if (!g._names[nameKey]) {
        g._names[nameKey] = disp;
        var distinctNames = Object.keys(g._names).map(function (k) { return g._names[k]; });
        if (distinctNames.length > 1) {
          g.name = distinctNames.join(' / ');
          g._keys = g._keys.concat(nameKeys(r.name)).filter(function (v, i, a) { return a.indexOf(v) === i; });
        }
      }
      g.rent += toNum(r.rent);
      g.deduction += toNum(r.deduction);
      g.addition += toNum(r.addition);
      g.rentalDue += toNum(r.rentalDue);
      if (g.account == null && r.account != null && String(r.account).trim() !== '') g.account = r.account;
      if (g.iban == null && r.iban != null && String(r.iban).trim() !== '') g.iban = r.iban;
      if (g.swift == null && r.swift != null && String(r.swift).trim() !== '') g.swift = r.swift;
    });
    return order.map(function (k) { return map[k]; });
  }

  /* ════════════════════════════════════════════
     AGGREGATE per client — Payment Info Sheet side
     ════════════════════════════════════════════ */

  function aggregatePI(allRows, filteredRows) {
    var filteredKeys = {};
    filteredRows.forEach(function (r) { filteredKeys[r.index] = true; });

    var map = {}, order = [];
    allRows.forEach(function (r) {
      var disp = r.clientName;
      if (!disp) return;
      var nameKey = normName(disp);
      if (!nameKey) return;
      var key = groupKey(r.iban, r.accountNo, nameKey);
      if (!map[key]) {
        map[key] = {
          name: disp, rental: 0, account: null, iban: null, swift: null,
          _keys: nameKeys(disp), _norm: nameKey, _names: {}
        };
        order.push(key);
      }
      var g = map[key];
      if (!g._names[nameKey]) {
        g._names[nameKey] = disp;
        var distinctNames = Object.keys(g._names).map(function (k) { return g._names[k]; });
        if (distinctNames.length > 1) {
          g.name = distinctNames.join(' / ');
          g._keys = g._keys.concat(nameKeys(disp)).filter(function (v, i, a) { return a.indexOf(v) === i; });
        }
      }
      if (filteredKeys[r.index]) {
        var val = r.isRerouted ? r.revisedRental : r.returnAmt;
        g.rental += toNum(val);
      }
      if (g.account == null && r.accountNo) g.account = r.accountNo;
      if (g.iban == null && r.iban) g.iban = r.iban;
      if (g.swift == null && r.swift) g.swift = r.swift;
    });
    return order.map(function (k) { return map[k]; });
  }

  /* ════════════════════════════════════════════
     MATCHING
     ════════════════════════════════════════════ */

  function buildIndex(payees) {
    var byKey = {}, flat = [];
    payees.forEach(function (p) {
      if (!p._keys) { p._keys = nameKeys(p.name); p._norm = p._keys[p._keys.length - 1] || ''; }
      flat.push(p);
      p._keys.forEach(function (k) { if (!byKey[k]) byKey[k] = p; });
    });
    return { byKey: byKey, flat: flat };
  }

  function findMatch(srcPayee, index) {
    var keys = srcPayee._keys || nameKeys(srcPayee.name);
    for (var i = 0; i < keys.length; i++) {
      if (index.byKey[keys[i]]) return index.byKey[keys[i]];
    }
    var src = srcPayee._norm || (keys[keys.length - 1] || '');
    var best = null, bestScore = 0;
    index.flat.forEach(function (p) {
      var sc = tokenSortRatio(src, p._norm);
      if (sc > bestScore) { bestScore = sc; best = p; }
    });
    return bestScore >= 88 ? best : null;
  }

  /* ════════════════════════════════════════════
     PERIOD (from generator file name)
     ════════════════════════════════════════════ */

  function derivePeriod(genFileName, genWb) {
    var day, mon, yr;
    var m = (genFileName || '').match(/PAYOUT[_\- ]*(\d{1,2})[_\- ]*([A-Za-z]{3})[A-Za-z]*[_\- ]*(\d{4})/i);
    if (m) {
      day = m[1]; mon = m[2].toUpperCase().slice(0, 3); yr = parseInt(m[3], 10);
    } else {
      var sn = genWb ? genWb.SheetNames[0] : '';
      var m2 = sn.match(/([A-Za-z]{3})[A-Za-z]*\s*(\d{4})/);
      if (!m2) return null;
      mon = m2[1].toUpperCase().slice(0, 3); yr = parseInt(m2[2], 10);
      day = /15/.test(sn) ? '15' : '30';
    }
    var mi = MONTHS.indexOf(mon);
    if (mi < 0) return null;
    var cycle = day === '15' ? '15' : '30';
    var payoutDate = cycle === '15' ? new Date(yr, mi, 15) : new Date(yr, mi + 1, 0);
    var dayStr = String(day).padStart(2, '0');
    return { token: dayStr + '_' + mon + yr, m: mi + 1, y: yr, cycle: cycle, payoutDate: payoutDate };
  }

  /* ════════════════════════════════════════════
     ROW BUILDER — Value Differences
     Returns null if nothing differs for this client.
     ════════════════════════════════════════════ */

  function valueRow(g, a, p) {
    var piRent = p ? p.rental : null;
    var rentalDiff = !numsEqual(g.rent, a.rent) ||
      (piRent != null && !numsEqual(piRent, g.rent)) ||
      (piRent != null && !numsEqual(piRent, a.rent));
    var dedDiff = !numsEqual(g.deduction, a.deduction);
    var addDiff = !numsEqual(g.addition, a.addition);
    var dueDiff = !numsEqual(g.rentalDue, a.rentalDue);
    var ibanDiff = bankDiffers(g, a) || (p && bankDiffers(g, p));

    if (!rentalDiff && !dedDiff && !addDiff && !dueDiff && !ibanDiff) return null;

    var tags = [];
    if (rentalDiff) tags.push('Rental');
    if (dedDiff) tags.push('Ded');
    if (addDiff) tags.push('Add');
    if (dueDiff) tags.push('Due');
    if (ibanDiff) tags.push('IBAN');

    return {
      client: g.name,
      piRent: piRent, genRent: g.rent, acctRent: a.rent,
      genDed: g.deduction, acctDed: a.deduction,
      genAdd: g.addition, acctAdd: a.addition,
      genDue: g.rentalDue, acctDue: a.rentalDue,
      piIban: p ? bankDisplay(p) : '', genIban: bankDisplay(g), acctIban: bankDisplay(a),
      diff: { rental: rentalDiff, ded: dedDiff, add: addDiff, due: dueDiff, iban: ibanDiff },
      diffFields: tags.join(',')
    };
  }

  /* ════════════════════════════════════════════
     CORE AUDIT
     ════════════════════════════════════════════ */

  function runAudit() {
    if (typeof window.parsePaymentSheet !== 'function' || typeof window.filterRowsForCycle !== 'function') {
      return Promise.reject(new Error('app.js / shared.js not loaded — parsePaymentSheet / filterRowsForCycle missing'));
    }
    if (typeof window.ExcelJS === 'undefined') {
      return Promise.reject(new Error('ExcelJS not loaded — check the script tag in aio-tool.html'));
    }

    return Promise.all([
      readWorkbook(files.gen),
      readWorkbook(files.acc),
      readPIRows(files.info)
    ]).then(function (res) {
      var genWb = res[0], accWb = res[1], piRawRows = res[2];

      var genPayees = aggregate(parseSheet(genWb.Sheets[genWb.SheetNames[0]]));
      var accPayees = aggregate(parseAccounts(accWb));

      var period = derivePeriod(files.gen.name, genWb);

      var allPIRows = window.parsePaymentSheet(piRawRows);
      var filteredPIRows = period
        ? window.filterRowsForCycle(allPIRows, period.cycle, period.payoutDate)
        : allPIRows;
      var piPayees = aggregatePI(allPIRows, filteredPIRows);

      var accIndex = buildIndex(accPayees);
      var piIndex  = buildIndex(piPayees);

      var values = [];
      var mineNotInAcc = [];
      var accNotInMine = [];
      var matchedAcc = {};
      var matchedCount = 0;

      genPayees.forEach(function (g) {
        var a = findMatch(g, accIndex);
        if (!a) { mineNotInAcc.push(g.name); return; }
        matchedAcc[a._norm] = true;
        matchedCount++;
        var p = findMatch(g, piIndex);
        var row = valueRow(g, a, p);
        if (row) values.push(row);
      });

      accPayees.forEach(function (a) {
        if (matchedAcc[a._norm]) return;
        accNotInMine.push(a.name);
      });

      var summary = {
        matched: matchedCount,
        differences: values.length,
        mineOnly: mineNotInAcc.length,
        accOnly: accNotInMine.length
      };

      lastFilename = 'PAYOUT_AUDIT_' + (period ? period.token : 'OUTPUT') + '.xlsx';

      return buildWorkbook(values, mineNotInAcc, accNotInMine, summary, period).then(function (wb) {
        lastWb = wb;
        return { values: values, mineNotInAcc: mineNotInAcc, accNotInMine: accNotInMine, summary: summary, period: period };
      });
    });
  }

  /* ════════════════════════════════════════════
     BUILD XLSX (ExcelJS — supports fill colors)
     ════════════════════════════════════════════ */

  var THIN_BORDER = {
    top: { style: 'thin', color: { argb: 'FFB7B7B7' } },
    left: { style: 'thin', color: { argb: 'FFB7B7B7' } },
    bottom: { style: 'thin', color: { argb: 'FFB7B7B7' } },
    right: { style: 'thin', color: { argb: 'FFB7B7B7' } }
  };

  function headerCell(ws, addr, text, color) {
    var cell = ws.getCell(addr);
    cell.value = text;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER;
    return cell;
  }

  function highlightCells(ws, rowNum, cols) {
    cols.forEach(function (c) {
      var cell = ws.getCell(rowNum, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_DIFF } };
    });
  }

  function borderRow(ws, rowNum, colCount) {
    for (var c = 1; c <= colCount; c++) {
      ws.getCell(rowNum, c).border = THIN_BORDER;
    }
  }

  function buildWorkbook(values, mineNotInAcc, accNotInMine, summary, period) {
    var wb = new window.ExcelJS.Workbook();

    /* ── Sheet 1: Value Differences ── */
    var ws = wb.addWorksheet('Value Differences');
    ws.columns = [
      { width: 34 }, { width: 12 }, { width: 12 }, { width: 12 },
      { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
      { width: 12 }, { width: 12 }, { width: 24 }, { width: 24 }, { width: 24 },
      { width: 18 }
    ];

    ws.mergeCells('A1:A2'); headerCell(ws, 'A1', 'Client', COLOR_HEADER1);
    ws.mergeCells('B1:D1'); headerCell(ws, 'B1', 'Rental', COLOR_HEADER1);
    ws.mergeCells('E1:F1'); headerCell(ws, 'E1', 'Deduction', COLOR_HEADER1);
    ws.mergeCells('G1:H1'); headerCell(ws, 'G1', 'Addition', COLOR_HEADER1);
    ws.mergeCells('I1:J1'); headerCell(ws, 'I1', 'Rental Due', COLOR_HEADER1);
    ws.mergeCells('K1:M1'); headerCell(ws, 'K1', 'IBAN', COLOR_HEADER1);
    ws.mergeCells('N1:N2'); headerCell(ws, 'N1', 'Diff Fields', COLOR_HEADER1);

    ['B2:PI','C2:Gen','D2:Acct','E2:Gen','F2:Acct','G2:Gen','H2:Acct','I2:Gen','J2:Acct','K2:PI','L2:Gen','M2:Acct'].forEach(function (pair) {
      var parts = pair.split(':');
      headerCell(ws, parts[0], parts[1], COLOR_HEADER2);
    });

    var rowNum = 3;
    values.forEach(function (v) {
      ws.getRow(rowNum).values = [
        v.client, v.piRent, v.genRent, v.acctRent,
        v.genDed, v.acctDed, v.genAdd, v.acctAdd,
        v.genDue, v.acctDue, v.piIban, v.genIban, v.acctIban,
        v.diffFields
      ];
      borderRow(ws, rowNum, 14);
      if (v.diff.rental) highlightCells(ws, rowNum, [2, 3, 4]);
      if (v.diff.ded)    highlightCells(ws, rowNum, [5, 6]);
      if (v.diff.add)    highlightCells(ws, rowNum, [7, 8]);
      if (v.diff.due)    highlightCells(ws, rowNum, [9, 10]);
      if (v.diff.iban)   highlightCells(ws, rowNum, [11, 12, 13]);
      rowNum++;
    });

    ws.views = [{ state: 'frozen', ySplit: 2, xSplit: 1 }];

    /* ── Sheet 2: Missing Clients ── */
    var ws2 = wb.addWorksheet('Missing Clients');
    ws2.columns = [{ width: 42 }, { width: 42 }];
    headerCell(ws2, 'A1', 'In My Payout, Not In Accounts List', COLOR_HEADER1);
    headerCell(ws2, 'B1', 'In Accounts List, Not In My Payout', COLOR_HEADER1);
    var maxLen = Math.max(mineNotInAcc.length, accNotInMine.length);
    for (var i = 0; i < maxLen; i++) {
      ws2.getRow(i + 2).values = [mineNotInAcc[i] || '', accNotInMine[i] || ''];
      borderRow(ws2, i + 2, 2);
    }

    return Promise.resolve(wb);
  }

  function downloadWorkbook(wb, filename) {
    return wb.xlsx.writeBuffer().then(function (buffer) {
      var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  /* ════════════════════════════════════════════
     UI
     ════════════════════════════════════════════ */

  function uploadCard(id, label, hint) {
    return '' +
    '<div class="card">' +
      '<div class="section-label">' + label + '</div>' +
      '<div class="upload-zone upload-zone-sm" id="' + id + '-zone">' +
        '<input type="file" accept=".xlsx,.xls" id="' + id + '-input" />' +
        '<div class="upload-zone-text"><strong>Click to upload</strong>' + hint + '</div>' +
      '</div>' +
      '<div class="file-loaded" id="' + id + '-loaded">' +
        '<span class="file-loaded-name"></span><span class="file-loaded-meta"></span></div>' +
    '</div>';
  }

  function render() {
    mount.innerHTML = '' +
      '<div class="upload-row">' +
        uploadCard('pa-gen',  'Payout Generator', '.xlsx') +
        uploadCard('pa-acc',  'Accounts List', '.xlsx') +
        uploadCard('pa-info', 'Payment Info Sheet (source of truth)', '.xlsx') +
      '</div>' +
      '<div class="card action-card">' +
        '<button class="btn-primary" id="pa-run" disabled>Run audit</button>' +
        '<button class="btn-primary" id="pa-dl" disabled>Download audit file</button>' +
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
    if (!lastWb) return;
    downloadWorkbook(lastWb, lastFilename);
  }

  function fmt2(v) { return v == null ? '—' : Math.round(toNum(v)).toLocaleString(); }

  function renderValueTable(values) {
    if (!values.length) return '';
    var head1 = '<tr>' +
      '<th rowspan="2">Client</th><th colspan="3">Rental</th><th colspan="2">Deduction</th>' +
      '<th colspan="2">Addition</th><th colspan="2">Rental Due</th><th colspan="3">IBAN</th>' +
      '<th rowspan="2">Diff Fields</th></tr>';
    var head2 = '<tr><th>PI</th><th>Gen</th><th>Acct</th><th>Gen</th><th>Acct</th>' +
      '<th>Gen</th><th>Acct</th><th>Gen</th><th>Acct</th><th>PI</th><th>Gen</th><th>Acct</th></tr>';

    var body = values.map(function (v) {
      function td(val, hi) { return '<td class="td-num' + (hi ? ' diff-hi' : '') + '">' + val + '</td>'; }
      return '<tr>' +
        '<td class="td-name">' + v.client + '</td>' +
        td(fmt2(v.piRent), v.diff.rental) + td(fmt2(v.genRent), v.diff.rental) + td(fmt2(v.acctRent), v.diff.rental) +
        td(fmt2(v.genDed), v.diff.ded) + td(fmt2(v.acctDed), v.diff.ded) +
        td(fmt2(v.genAdd), v.diff.add) + td(fmt2(v.acctAdd), v.diff.add) +
        td(fmt2(v.genDue), v.diff.due) + td(fmt2(v.acctDue), v.diff.due) +
        td(v.piIban || '—', v.diff.iban) + td(v.genIban || '—', v.diff.iban) + td(v.acctIban || '—', v.diff.iban) +
        '<td class="td-name">' + v.diffFields + '</td>' +
        '</tr>';
    }).join('');

    return '<div class="card"><div class="results-header"><span class="results-title">Value differences (' + values.length + ')</span></div>' +
      '<div class="table-wrap"><table><thead>' + head1 + head2 + '</thead><tbody>' + body + '</tbody></table></div></div>' +
      '<style>.diff-hi{background:rgba(255,220,100,0.28)!important;}</style>';
  }

  function renderMissingTable(mineNotInAcc, accNotInMine) {
    if (!mineNotInAcc.length && !accNotInMine.length) return '';
    var maxLen = Math.max(mineNotInAcc.length, accNotInMine.length);
    var rows = '';
    for (var i = 0; i < maxLen; i++) {
      rows += '<tr><td class="td-name">' + (mineNotInAcc[i] || '') + '</td><td class="td-name">' + (accNotInMine[i] || '') + '</td></tr>';
    }
    return '<div class="card"><div class="results-header"><span class="results-title">Missing clients</span></div>' +
      '<div class="table-wrap"><table><thead><tr><th>In My Payout, Not In Accounts List</th><th>In Accounts List, Not In My Payout</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
  }

  function statBox(val, lbl) {
    return '<div class="stat-box"><span class="stat-val">' + val + '</span><span class="stat-lbl">' + lbl + '</span></div>';
  }

  function renderResults(res) {
    var sm = res.summary;
    var html = '<div class="card"><div class="stats-grid">' +
      statBox(sm.matched, 'Matched') +
      statBox(sm.differences, 'Differences') +
      statBox(sm.mineOnly, 'Mine only') +
      statBox(sm.accOnly, 'Accounts only') +
      '</div></div>';

    html += renderValueTable(res.values);
    html += renderMissingTable(res.mineNotInAcc, res.accNotInMine);

    document.getElementById('pa-results').innerHTML = html;
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
