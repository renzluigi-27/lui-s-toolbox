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

  // Account/IBAN/SWIFT must stay actual strings, never raw JS numbers —
  // same fix the Payout Generator and Payment Info parser already use.
  // A numeric cell written straight into Excel gets Excel's own "General"
  // format applied, which switches to scientific notation for big
  // integers depending on column width (972396217001 -> 9.72396E+11).
  // A string cell is never reformatted. Also recovers the digits if the
  // source cell was itself already scientific-notation text.
  function idString(v) {
    if (v == null || v === '') return null;
    var s = String(v).trim();
    if (!s) return null;
    if (/e\+/i.test(s)) {
      var n = Number(s);
      if (!isNaN(n)) s = n.toLocaleString('fullwide', { useGrouping: false });
    }
    return s;
  }

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

  /* ── separate Account No. / IBAN / SWIFT comparisons for the Bank
     Details sheet — a shared IBAN with different account numbers (US
     routing-number style entries) shouldn't collapse into one diff. ── */
  function accountDiffers(a, b) {
    var accA = normAccount(a && a.account), accB = normAccount(b && b.account);
    if (accA && accB && isRoundingOnly(accA, accB)) return false;
    return accA !== accB;
  }
  function ibanFieldDiffers(a, b) {
    var ibA = normIBAN(a && a.iban), ibB = normIBAN(b && b.iban);
    return ibA !== ibB;
  }
  function swiftDiffers(a, b) {
    var swA = a && a.swift ? String(a.swift).toUpperCase().replace(/\s+/g, '') : '';
    var swB = b && b.swift ? String(b.swift).toUpperCase().replace(/\s+/g, '') : '';
    // Accounts' Local sheet never captures SWIFT — only flag when both
    // sides actually have a value to compare (avoids flooding false
    // positives on every Local client).
    if (!swA || !swB) return false;
    return swA !== swB;
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
    eidName:    ['name as per eid', 'name as eid', 'eid name'],
    rent:       ['monthly rent', 'monthly rental', 'rent', 'rental', 'new rental'],
    deduction:  ['deduction'],
    addition:   ['addition'],
    rentalDue:  ['rental due', 'due', 'rental amount'],
    account:    ['account no', 'account number', 'account', 'acc no'],
    iban:       ['iban no', 'iban', 'iban number'],
    swift:      ['swift code', 'swift'],
    clientType: ['client type'],
    notes:      ['notes', 'note'],
    remarks:    ['remarks - deepa', 'remarks', 'remark']
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

  function parseSheet(ws, sheetName) {
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
        eidName: g('eidName'),
        rent: g('rent'),
        deduction: g('deduction'),
        addition: g('addition'),
        rentalDue: g('rentalDue'),
        account: idString(g('account')),
        iban: idString(g('iban')),
        swift: idString(g('swift')),
        clientType: g('clientType'),
        notes: g('notes'),
        remarks: g('remarks'),
        sheetName: sheetName || null,
        rowOrder: i,
        _raw: raw
      });
    }
    return rows;
  }

  function parseAccounts(wb) {
    var all = [];
    wb.SheetNames.forEach(function (sn) {
      parseSheet(wb.Sheets[sn], sn).forEach(function (r) { all.push(r); });
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
          notes: [], remarks: [], clientType: null, sheetName: null, rowOrder: null,
          _keys: nameKeys(r.name), _norm: nameKey, _names: {}
        };
        order.push(key);
      }
      var g = map[key];
      // Fold "Name as Per EID" into the matching keys too — Accounts sometimes
      // truncates/typos Column A (Client name) but has the full correct name
      // in Column B (Name as Per EID). Either one should be able to match.
      if (r.eidName && String(r.eidName).trim()) {
        nameKeys(r.eidName).forEach(function (k) {
          if (k && g._keys.indexOf(k) === -1) g._keys.push(k);
        });
      }
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
      if (r.notes != null && String(r.notes).trim() !== '' && g.notes.indexOf(String(r.notes).trim()) === -1) {
        g.notes.push(String(r.notes).trim());
      }
      if (r.remarks != null && String(r.remarks).trim() !== '' && g.remarks.indexOf(String(r.remarks).trim()) === -1) {
        g.remarks.push(String(r.remarks).trim());
      }
      if (g.clientType == null && r.clientType != null && String(r.clientType).trim() !== '') {
        g.clientType = String(r.clientType).trim();
      }
      if (g.sheetName == null && r.sheetName) g.sheetName = r.sheetName;
      if (g.rowOrder == null && r.rowOrder != null) g.rowOrder = r.rowOrder;
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
          _keys: nameKeys(disp), _norm: nameKey, _names: {}, rawRows: []
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
      g.rawRows.push(r);
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

  /* ── reason a payee sits in "Accounts List, Not In My Payout" —
     mirrors the Payment Info cross-check: terminated / wrong cycle /
     rerouted-needs-verification / genuine gap. ── */
  function piReasonForGroup(piGroup, cycle) {
    if (!piGroup || !piGroup.rawRows || !piGroup.rawRows.length) {
      return 'No match found in Payment Info Sheet — verify client name/spelling';
    }
    var rows = piGroup.rawRows;
    var active = rows.filter(function (r) { return !r.isTerminated; });
    if (!active.length) {
      return 'All Payment Info rows marked Termination — expected exclusion, not a real gap';
    }
    function effCycle(r) {
      if (r.isRerouted && r.restartDate) return r.restartDate.getDate() <= 15 ? '15' : '30';
      return String(r.payoutCycle || '').replace(/\s/g, '');
    }
    var cycles = {};
    active.forEach(function (r) { cycles[effCycle(r)] = true; });
    var wantCycle = cycle === '15' ? '15' : '30';
    var cycleOk = wantCycle === '15' ? !!cycles['15'] : !!(cycles['30'] || cycles['31'] || cycles['30/31']);
    if (!cycleOk) {
      return 'Payment Info cycle is ' + Object.keys(cycles).join(', ') + ', not ' + (wantCycle === '15' ? '15th' : '30th/31st') + ' — belongs to different cycle';
    }
    var reroutes = active.filter(function (r) { return r.isRerouted && r.restartDate; });
    if (reroutes.length) {
      var dates = reroutes.map(function (r) { return fmtDate(r.restartDate); });
      var uniqueDates = dates.filter(function (v, i, a) { return a.indexOf(v) === i; });
      return 'Rerouted client, restart date ' + uniqueDates.join(', ') + ' — verify against reroute anniversary before flagging as gap';
    }
    return 'Active, cycle ' + wantCycle + ', no restart flag — genuine gap, needs review';
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

  /* ── Local / International classification — prefer which Accounts sheet
     the payee was found on (sheet name itself carries the answer), fall
     back to the Gen file's Client Type column. ── */
  function classify(genRow, accRow) {
    if (accRow && accRow.sheetName) {
      var sn = String(accRow.sheetName).toLowerCase();
      if (sn.indexOf('international') > -1) return 'International';
      if (sn.indexOf('local') > -1) return 'Local';
    }
    if (genRow && genRow.clientType) {
      var ct = String(genRow.clientType).toLowerCase();
      if (ct.indexOf('international') > -1) return 'International';
      if (ct.indexOf('local') > -1) return 'Local';
    }
    return 'Unclassified';
  }

  /* ── "this client has another bank account already matched elsewhere" —
     for Missing Clients entries, check whether the same person (by name
     token overlap) already has a different, matched account so it's clear
     this is a second/extra account gap, not an unknown client. ── */
  function surnameTokens(name) {
    var base = String(name || '').replace(/\([^)]*\)/g, ' ').trim();
    return base.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 2; });
  }

  function findOtherAccountNote(missingName, matchedNames) {
    var mtoks = surnameTokens(missingName);
    if (!mtoks.length) return '';
    var bestMatch = null, bestScore = 0;
    matchedNames.forEach(function (n) {
      if (n === missingName) return;
      var ntoks = surnameTokens(n);
      var overlap = mtoks.filter(function (t) { return ntoks.indexOf(t) > -1; }).length;
      var minLen = Math.min(mtoks.length, ntoks.length);
      if (!minLen) return;
      var overlapRatio = overlap / minLen;
      var score = tokenSortRatio(missingName.toLowerCase(), n.toLowerCase());
      if (overlapRatio >= 0.6 && score >= 75 && score > bestScore) {
        bestScore = score; bestMatch = n;
      }
    });
    return bestMatch
      ? 'Client has another bank account already matched as "' + bestMatch + '" — this is an additional account not yet reconciled'
      : '';
  }

  /* ════════════════════════════════════════════
     PERIOD (from generator file name)
     ════════════════════════════════════════════ */

  // Time-of-generation stamp so re-running the audit doesn't produce the
  // same filename twice — a repeated name makes the browser silently
  // suffix "(1)", "(2)" etc, which is confusing when comparing runs.
  function genStamp() {
    var d = new Date();
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

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
     ROW BUILDER — per-field diff computation
     Always returns the full comparison; callers decide which
     category sheet(s) a client belongs in based on the flags.
     ════════════════════════════════════════════ */

  function mathCheck(rent, ded, add, due) {
    var expected = Math.round((toNum(rent) - toNum(ded) + toNum(add)) * 100) / 100;
    var actual = Math.round(toNum(due) * 100) / 100;
    return { ok: Math.abs(expected - actual) < 0.005, expected: expected };
  }

  function valueRow(g, a, p) {
    var piRent = p ? p.rental : null;
    var rentalDiff = !numsEqual(g.rent, a.rent);
    var dedDiff = !numsEqual(g.deduction, a.deduction);
    var addDiff = !numsEqual(g.addition, a.addition);
    var dueDiff = !numsEqual(g.rentalDue, a.rentalDue);
    var accDiff = accountDiffers(g, a);
    var ibanDiff = ibanFieldDiffers(g, a);
    var swiftDiff = swiftDiffers(g, a);

    var genMath = mathCheck(g.rent, g.deduction, g.addition, g.rentalDue);
    var acctMath = mathCheck(a.rent, a.deduction, a.addition, a.rentalDue);

    return {
      client: g.name,
      class: classify(g, a),
      rowOrder: a.rowOrder,
      genNotes: (g.notes || []).join(' | ') || '-',
      acctRemarks: (a.remarks || []).join(' | ') || '-',
      piRent: piRent, genRent: g.rent, acctRent: a.rent,
      genDed: g.deduction, acctDed: a.deduction,
      genAdd: g.addition, acctAdd: a.addition,
      genDue: g.rentalDue, acctDue: a.rentalDue,
      genAccount: g.account, acctAccount: a.account,
      genIban: g.iban, acctIban: a.iban,
      genSwift: g.swift, acctSwift: a.swift,
      genMath: genMath, acctMath: acctMath,
      diff: {
        rental: rentalDiff, ded: dedDiff, add: addDiff, due: dueDiff,
        account: accDiff, iban: ibanDiff, swift: swiftDiff
      }
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

      var genSheetName = genWb.SheetNames[0];
      var genPayees = aggregate(parseSheet(genWb.Sheets[genSheetName], genSheetName));
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
      var mineNotInAcc = [];       // {name, class}
      var accNotInMine = [];       // {name, class}
      var matchedAcc = {};
      var matchedCount = 0;
      var allMatchedNames = [];    // for "another account" cross-reference

      genPayees.forEach(function (g) {
        var a = findMatch(g, accIndex);
        if (!a) {
          mineNotInAcc.push({ name: g.name, class: classify(g, null) });
          return;
        }
        matchedAcc[a._norm] = true;
        matchedCount++;
        allMatchedNames.push(g.name);
        var p = findMatch(g, piIndex);
        values.push(valueRow(g, a, p));
      });

      accPayees.forEach(function (a) {
        if (matchedAcc[a._norm]) return;
        accNotInMine.push({ name: a.name, class: classify(null, a) });
      });

      // Missing-clients notes: PI cross-check reason first (termination /
      // wrong cycle / rerouted-needs-check / genuine gap), then the
      // "another account already matched" cross-reference as a secondary
      // note when relevant.
      var cycleForReason = period ? period.cycle : '15';
      mineNotInAcc.forEach(function (m) {
        var otherAcc = findOtherAccountNote(m.name, allMatchedNames);
        m.note = otherAcc || '-';
      });
      accNotInMine.forEach(function (m) {
        var pig = findMatch({ name: m.name, _keys: nameKeys(m.name), _norm: normName(m.name) }, piIndex);
        var reason = piReasonForGroup(pig, cycleForReason);
        var otherAcc = findOtherAccountNote(m.name, allMatchedNames);
        m.note = otherAcc ? reason + ' | ' + otherAcc : reason;
      });

      // sort value rows to follow the Accounts payout list's own row order
      values.sort(function (x, y) {
        var ox = x.rowOrder == null ? Infinity : x.rowOrder;
        var oy = y.rowOrder == null ? Infinity : y.rowOrder;
        if (ox !== oy) return ox - oy;
        return x.client.localeCompare(y.client);
      });

      /* ── split into the 5 category groups. A client can appear in more
         than one (e.g. Rental + Bank Details) since each sheet is scoped
         to its own field(s). ── */
      var rentalRows = [], deductionRows = [], additionRows = [], dueRows = [], bankRows = [];

      values.forEach(function (v) {
        if (v.diff.rental) {
          rentalRows.push({
            client: v.client, pi: v.piRent, gen: v.genRent, acct: v.acctRent,
            diff: Math.round(((v.acctRent || 0) - (v.genRent || 0)) * 100) / 100,
            acctRemarks: v.acctRemarks, genNotes: v.genNotes
          });
        }
        if (v.diff.ded) {
          deductionRows.push({
            client: v.client, gen: v.genDed, acct: v.acctDed,
            diff: Math.round(((v.acctDed || 0) - (v.genDed || 0)) * 100) / 100,
            acctRemarks: v.acctRemarks, genNotes: v.genNotes
          });
        }
        if (v.diff.add) {
          additionRows.push({
            client: v.client, gen: v.genAdd, acct: v.acctAdd,
            diff: Math.round(((v.acctAdd || 0) - (v.genAdd || 0)) * 100) / 100,
            acctRemarks: v.acctRemarks, genNotes: v.genNotes
          });
        }
        if (v.diff.due) {
          dueRows.push({
            client: v.client,
            genRent: v.genRent, genDed: v.genDed, genAdd: v.genAdd, genDue: v.genDue,
            acctRent: v.acctRent, acctDed: v.acctDed, acctAdd: v.acctAdd, acctDue: v.acctDue,
            acctRemarks: v.acctRemarks, genNotes: v.genNotes
          });
        }
        if (v.diff.account || v.diff.iban || v.diff.swift) {
          var tags = [];
          if (v.diff.account) tags.push('Account No.');
          if (v.diff.iban) tags.push('IBAN');
          if (v.diff.swift) tags.push('SWIFT');
          bankRows.push({
            client: v.client,
            genAccount: v.genAccount, acctAccount: v.acctAccount,
            genIban: v.genIban, acctIban: v.acctIban,
            genSwift: v.genSwift, acctSwift: v.acctSwift,
            diffFields: tags.join(', '),
            acctRemarks: v.acctRemarks, genNotes: v.genNotes
          });
        }
      });

      /* ── Local / International full per-client summary — combines every
         field into one row per client (only rows with at least one diff),
         split by classification. Same sort as the 5 category sheets. ── */
      var classRows = values.filter(function (v) {
        return v.diff.rental || v.diff.ded || v.diff.add || v.diff.due ||
          v.diff.account || v.diff.iban || v.diff.swift;
      }).map(function (v) {
        var tags = [];
        if (v.diff.rental) tags.push('Rental');
        if (v.diff.ded) tags.push('Ded');
        if (v.diff.add) tags.push('Add');
        if (v.diff.due) tags.push('Due');
        if (v.diff.account) tags.push('Account No.');
        if (v.diff.iban) tags.push('IBAN');
        if (v.diff.swift) tags.push('SWIFT');
        return {
          client: v.client, class: v.class,
          piRent: v.piRent, genRent: v.genRent, acctRent: v.acctRent,
          genDed: v.genDed, acctDed: v.acctDed,
          genAdd: v.genAdd, acctAdd: v.acctAdd,
          genDue: v.genDue, acctDue: v.acctDue,
          genAccount: v.genAccount, acctAccount: v.acctAccount,
          genIban: v.genIban, acctIban: v.acctIban,
          genSwift: v.genSwift, acctSwift: v.acctSwift,
          diffFields: tags.join(', '),
          acctRemarks: v.acctRemarks, genNotes: v.genNotes
        };
      });
      var localRows = classRows.filter(function (r) { return r.class === 'Local'; });
      // Only 2 sheets requested (Local / International) — any 'Unclassified'
      // (couldn't determine from Accounts sheet name or Gen's Client Type)
      // folds into International here so it isn't silently dropped.
      var intlRows = classRows.filter(function (r) { return r.class !== 'Local'; });

      var summary = {
        matched: matchedCount,
        differences: values.length,
        mineOnly: mineNotInAcc.length,
        accOnly: accNotInMine.length,
        rental: rentalRows.length, deduction: deductionRows.length,
        addition: additionRows.length, due: dueRows.length, bank: bankRows.length,
        local: localRows.length, intl: intlRows.length
      };

      lastFilename = 'PAYOUT_AUDIT_' + (period ? period.token : 'OUTPUT') + '_' + genStamp() + '.xlsx';

      return buildWorkbook(rentalRows, deductionRows, additionRows, dueRows, bankRows,
        localRows, intlRows, mineNotInAcc, accNotInMine, summary, period).then(function (wb) {
        lastWb = wb;
        return {
          rentalRows: rentalRows, deductionRows: deductionRows, additionRows: additionRows,
          dueRows: dueRows, bankRows: bankRows, localRows: localRows, intlRows: intlRows,
          mineNotInAcc: mineNotInAcc, accNotInMine: accNotInMine,
          summary: summary, period: period
        };
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

  function headerRow(ws, headers) {
    headers.forEach(function (text, i) {
      var cell = ws.getCell(1, i + 1);
      cell.value = text;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER1 } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = THIN_BORDER;
    });
  }

  function buildRentalSheet(wb, rows) {
    var ws = wb.addWorksheet('Rental');
    ws.columns = [{ width: 34 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 16 }, { width: 20 }, { width: 45 }];
    headerRow(ws, ['Client', 'PI Rental', 'Gen Rental', 'Acct Rental', 'Diff (Acct-Gen)', 'Accounts Remarks', 'Gen Notes']);
    rows.forEach(function (r, i) {
      var rn = i + 2;
      ws.getRow(rn).values = [r.client, r.pi, r.gen, r.acct, r.diff, r.acctRemarks, r.genNotes];
      borderRow(ws, rn, 7);
      highlightCells(ws, rn, [3, 4]);
    });
    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
    return ws;
  }

  function buildDeductionSheet(wb, rows) {
    var ws = wb.addWorksheet('Deduction');
    ws.columns = [{ width: 34 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 20 }, { width: 45 }];
    headerRow(ws, ['Client', 'Gen Deduction', 'Acct Deduction', 'Diff (Acct-Gen)', 'Accounts Remarks', 'Gen Notes']);
    rows.forEach(function (r, i) {
      var rn = i + 2;
      ws.getRow(rn).values = [r.client, r.gen, r.acct, r.diff, r.acctRemarks, r.genNotes];
      borderRow(ws, rn, 6);
      highlightCells(ws, rn, [2, 3]);
    });
    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
    return ws;
  }

  function buildAdditionSheet(wb, rows) {
    var ws = wb.addWorksheet('Addition');
    ws.columns = [{ width: 34 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 20 }, { width: 45 }];
    headerRow(ws, ['Client', 'Gen Addition', 'Acct Addition', 'Diff (Acct-Gen)', 'Accounts Remarks', 'Gen Notes']);
    rows.forEach(function (r, i) {
      var rn = i + 2;
      ws.getRow(rn).values = [r.client, r.gen, r.acct, r.diff, r.acctRemarks, r.genNotes];
      borderRow(ws, rn, 6);
      highlightCells(ws, rn, [2, 3]);
    });
    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
    return ws;
  }

  var COLOR_MISMATCH = 'FFFFC7CE'; // pale red — math-check failure

  function buildRentalDueSheet(wb, rows) {
    var ws = wb.addWorksheet('Rental Due');
    ws.columns = [
      { width: 34 }, { width: 12 }, { width: 13 }, { width: 12 }, { width: 11 },
      { width: 12 }, { width: 13 }, { width: 12 }, { width: 11 },
      { width: 20 }, { width: 45 }
    ];
    headerRow(ws, ['Client', 'Gen Rental', 'Gen Deduction', 'Gen Addition', 'Gen Due',
      'Acct Rental', 'Acct Deduction', 'Acct Addition', 'Acct Due',
      'Accounts Remarks', 'Gen Notes']);
    rows.forEach(function (r, i) {
      var rn = i + 2;
      ws.getRow(rn).values = [
        r.client, r.genRent, r.genDed, r.genAdd, r.genDue,
        r.acctRent, r.acctDed, r.acctAdd, r.acctDue,
        r.acctRemarks, r.genNotes
      ];
      borderRow(ws, rn, 11);
      highlightCells(ws, rn, [5, 9]);
    });
    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
    return ws;
  }

  function buildBankDetailsSheet(wb, rows) {
    var ws = wb.addWorksheet('Bank Details');
    ws.columns = [
      { width: 34 }, { width: 20 }, { width: 20 }, { width: 26 }, { width: 26 },
      { width: 14 }, { width: 14 }, { width: 24 }, { width: 20 }, { width: 45 }
    ];
    headerRow(ws, ['Client', 'Gen Account No.', 'Acct Account No.', 'Gen IBAN', 'Acct IBAN',
      'Gen SWIFT', 'Acct SWIFT', 'Diff Fields', 'Accounts Remarks', 'Gen Notes']);
    rows.forEach(function (r, i) {
      var rn = i + 2;
      ws.getRow(rn).values = [
        r.client, r.genAccount, r.acctAccount, r.genIban, r.acctIban,
        r.genSwift, r.acctSwift, r.diffFields, r.acctRemarks, r.genNotes
      ];
      borderRow(ws, rn, 10);
      if (r.diffFields.indexOf('Account No.') > -1) highlightCells(ws, rn, [2, 3]);
      if (r.diffFields.indexOf('IBAN') > -1) highlightCells(ws, rn, [4, 5]);
      if (r.diffFields.indexOf('SWIFT') > -1) highlightCells(ws, rn, [6, 7]);
    });
    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
    return ws;
  }

  /* ── Local / International — full per-client summary, single header
     row, every field in one place. Same shape as the old combined
     comparison sheet, just modernized (single-row header + notes). ── */
  function buildClassSummarySheet(wb, sheetName, rows) {
    var ws = wb.addWorksheet(sheetName);
    ws.columns = [
      { width: 34 }, { width: 11 }, { width: 11 }, { width: 11 },
      { width: 12 }, { width: 12 }, { width: 11 }, { width: 11 },
      { width: 10 }, { width: 10 },
      { width: 18 }, { width: 18 }, { width: 24 }, { width: 24 },
      { width: 13 }, { width: 13 }, { width: 22 }, { width: 20 }, { width: 45 }
    ];
    headerRow(ws, ['Client', 'PI Rental', 'Gen Rental', 'Acct Rental',
      'Gen Deduction', 'Acct Deduction', 'Gen Addition', 'Acct Addition',
      'Gen Due', 'Acct Due',
      'Gen Account No.', 'Acct Account No.', 'Gen IBAN', 'Acct IBAN',
      'Gen SWIFT', 'Acct SWIFT', 'Diff Fields', 'Accounts Remarks', 'Gen Notes']);
    rows.forEach(function (r, i) {
      var rn = i + 2;
      ws.getRow(rn).values = [
        r.client, r.piRent, r.genRent, r.acctRent,
        r.genDed, r.acctDed, r.genAdd, r.acctAdd,
        r.genDue, r.acctDue,
        r.genAccount, r.acctAccount, r.genIban, r.acctIban,
        r.genSwift, r.acctSwift, r.diffFields, r.acctRemarks, r.genNotes
      ];
      borderRow(ws, rn, 19);
      var tags = r.diffFields;
      if (tags.indexOf('Rental') > -1) highlightCells(ws, rn, [3, 4]);
      if (tags.indexOf('Ded') > -1) highlightCells(ws, rn, [5, 6]);
      if (tags.indexOf('Add') > -1) highlightCells(ws, rn, [7, 8]);
      if (tags.indexOf('Due') > -1) highlightCells(ws, rn, [9, 10]);
      if (tags.indexOf('Account No.') > -1) highlightCells(ws, rn, [11, 12]);
      if (tags.indexOf('IBAN') > -1) highlightCells(ws, rn, [13, 14]);
      if (tags.indexOf('SWIFT') > -1) highlightCells(ws, rn, [15, 16]);
    });
    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
    return ws;
  }

  function buildWorkbook(rentalRows, deductionRows, additionRows, dueRows, bankRows,
      localRows, intlRows, mineNotInAcc, accNotInMine, summary, period) {
    var wb = new window.ExcelJS.Workbook();

    buildClassSummarySheet(wb, 'Local', localRows);
    buildClassSummarySheet(wb, 'International', intlRows);
    buildRentalDueSheet(wb, dueRows);
    buildRentalSheet(wb, rentalRows);
    buildDeductionSheet(wb, deductionRows);
    buildAdditionSheet(wb, additionRows);
    buildBankDetailsSheet(wb, bankRows);

    /* ── Missing Clients — PI cross-check reason + "another account" cross-ref ── */
    var ws2 = wb.addWorksheet('Missing Clients');
    ws2.columns = [{ width: 38 }, { width: 42 }, { width: 16 }, { width: 55 }, { width: 14 }, { width: 14 }];
    headerRow(ws2, ['In My Payout, Not In Accounts List', 'In Accounts List, Not In My Payout',
      'Note (Col A)', 'Note (Col B)', 'Local/Intl (Col A)', 'Local/Intl (Col B)']);
    var maxLen = Math.max(mineNotInAcc.length, accNotInMine.length);
    for (var i = 0; i < maxLen; i++) {
      var mA = mineNotInAcc[i], mB = accNotInMine[i];
      ws2.getRow(i + 2).values = [
        mA ? mA.name : '', mB ? mB.name : '',
        mA ? (mA.note || '-') : '', mB ? (mB.note || '-') : '',
        mA ? mA.class : '', mB ? mB.class : ''
      ];
      borderRow(ws2, i + 2, 6);
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

  function simpleTable(title, headers, rows, hiCols) {
    if (!rows.length) return '';
    var head = '<tr>' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r) {
      return '<tr>' + r.map(function (cell, i) {
        var isName = i === 0;
        var hi = hiCols && hiCols.indexOf(i) > -1;
        return '<td class="' + (isName ? 'td-name' : 'td-num') + (hi ? ' diff-hi' : '') + '">' + cell + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="card"><div class="results-header"><span class="results-title">' + title + ' (' + rows.length + ')</span></div>' +
      '<div class="table-wrap"><table><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></div>' +
      '<style>.diff-hi{background:rgba(255,220,100,0.28)!important;}</style>';
  }

  function renderRentalTable(rows) {
    return simpleTable('Rental', ['Client', 'PI Rental', 'Gen Rental', 'Acct Rental', 'Diff (Acct-Gen)', 'Accounts Remarks', 'Gen Notes'],
      rows.map(function (r) { return [esc2(r.client), fmt2(r.pi), fmt2(r.gen), fmt2(r.acct), fmt2(r.diff), esc2(r.acctRemarks), esc2(r.genNotes)]; }),
      [2, 3]);
  }
  function renderDeductionTable(rows) {
    return simpleTable('Deduction', ['Client', 'Gen Deduction', 'Acct Deduction', 'Diff (Acct-Gen)', 'Accounts Remarks', 'Gen Notes'],
      rows.map(function (r) { return [esc2(r.client), fmt2(r.gen), fmt2(r.acct), fmt2(r.diff), esc2(r.acctRemarks), esc2(r.genNotes)]; }),
      [1, 2]);
  }
  function renderAdditionTable(rows) {
    return simpleTable('Addition', ['Client', 'Gen Addition', 'Acct Addition', 'Diff (Acct-Gen)', 'Accounts Remarks', 'Gen Notes'],
      rows.map(function (r) { return [esc2(r.client), fmt2(r.gen), fmt2(r.acct), fmt2(r.diff), esc2(r.acctRemarks), esc2(r.genNotes)]; }),
      [1, 2]);
  }
  function renderDueTable(rows) {
    return simpleTable('Rental Due',
      ['Client', 'Gen Rental', 'Gen Ded', 'Gen Add', 'Gen Due', 'Acct Rental', 'Acct Ded', 'Acct Add', 'Acct Due', 'Accounts Remarks', 'Gen Notes'],
      rows.map(function (r) {
        return [esc2(r.client), fmt2(r.genRent), fmt2(r.genDed), fmt2(r.genAdd), fmt2(r.genDue),
          fmt2(r.acctRent), fmt2(r.acctDed), fmt2(r.acctAdd), fmt2(r.acctDue), esc2(r.acctRemarks), esc2(r.genNotes)];
      }), [4, 8]);
  }
  function renderBankTable(rows) {
    return simpleTable('Bank Details', ['Client', 'Gen Account No.', 'Acct Account No.', 'Gen IBAN', 'Acct IBAN', 'Gen SWIFT', 'Acct SWIFT', 'Diff Fields', 'Accounts Remarks', 'Gen Notes'],
      rows.map(function (r) {
        return [esc2(r.client), esc2(r.genAccount || '—'), esc2(r.acctAccount || '—'), esc2(r.genIban || '—'), esc2(r.acctIban || '—'),
          esc2(r.genSwift || '—'), esc2(r.acctSwift || '—'), esc2(r.diffFields), esc2(r.acctRemarks), esc2(r.genNotes)];
      }), [1, 2, 3, 4, 5, 6]);
  }

  function renderClassTable(title, rows) {
    return simpleTable(title,
      ['Client', 'PI Rental', 'Gen Rental', 'Acct Rental', 'Gen Ded', 'Acct Ded', 'Gen Add', 'Acct Add',
        'Gen Due', 'Acct Due', 'Gen Account', 'Acct Account', 'Gen IBAN', 'Acct IBAN',
        'Gen SWIFT', 'Acct SWIFT', 'Diff Fields', 'Accounts Remarks', 'Gen Notes'],
      rows.map(function (r) {
        return [esc2(r.client), fmt2(r.piRent), fmt2(r.genRent), fmt2(r.acctRent),
          fmt2(r.genDed), fmt2(r.acctDed), fmt2(r.genAdd), fmt2(r.acctAdd),
          fmt2(r.genDue), fmt2(r.acctDue),
          esc2(r.genAccount || '—'), esc2(r.acctAccount || '—'), esc2(r.genIban || '—'), esc2(r.acctIban || '—'),
          esc2(r.genSwift || '—'), esc2(r.acctSwift || '—'), esc2(r.diffFields), esc2(r.acctRemarks), esc2(r.genNotes)];
      }), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  }

  function renderMissingTable(mineNotInAcc, accNotInMine) {
    if (!mineNotInAcc.length && !accNotInMine.length) return '';
    var maxLen = Math.max(mineNotInAcc.length, accNotInMine.length);
    var rows = '';
    for (var i = 0; i < maxLen; i++) {
      var mA = mineNotInAcc[i], mB = accNotInMine[i];
      var aName = mA ? esc2(mA.name) + (mA.note ? '<br><span class="td-hint">' + esc2(mA.note) + '</span>' : '') : '';
      var bName = mB ? esc2(mB.name) + (mB.note ? '<br><span class="td-hint">' + esc2(mB.note) + '</span>' : '') : '';
      rows += '<tr><td class="td-name">' + aName + '</td><td class="td-name">' + bName + '</td></tr>';
    }
    return '<div class="card"><div class="results-header"><span class="results-title">Missing clients</span></div>' +
      '<div class="table-wrap"><table><thead><tr><th>In My Payout, Not In Accounts List</th><th>In Accounts List, Not In My Payout</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
  }

  function esc2(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function statBox(val, lbl) {
    return '<div class="stat-box"><span class="stat-val">' + val + '</span><span class="stat-lbl">' + lbl + '</span></div>';
  }

  function renderResults(res) {
    var sm = res.summary;
    var html = '<div class="card"><div class="stats-grid">' +
      statBox(sm.matched, 'Matched') +
      statBox(sm.local, 'Local') +
      statBox(sm.intl, 'International') +
      statBox(sm.due, 'Rental Due') +
      statBox(sm.rental, 'Rental') +
      statBox(sm.deduction, 'Deduction') +
      statBox(sm.addition, 'Addition') +
      statBox(sm.bank, 'Bank Details') +
      statBox(sm.mineOnly, 'Mine only') +
      statBox(sm.accOnly, 'Accounts only') +
      '</div></div>';

    html += renderClassTable('Local', res.localRows);
    html += renderClassTable('International', res.intlRows);
    html += renderDueTable(res.dueRows);
    html += renderRentalTable(res.rentalRows);
    html += renderDeductionTable(res.deductionRows);
    html += renderAdditionTable(res.additionRows);
    html += renderBankTable(res.bankRows);
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
