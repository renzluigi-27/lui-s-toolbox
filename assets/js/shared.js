// ─────────────────────────────────────────────────────────────────
// SHARED UTILITIES — shared.js
// Date parsing, name normalization, deduction logic, formatting
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// DATE UTILITIES
// ─────────────────────────────────────────────────────────────────
function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + val * 86400000);
  }
  if (val instanceof Date) {
    if (isNaN(val)) return null;
    // cellDates:true returns MM/DD — swap to DD/MM
    return new Date(val.getFullYear(), val.getDate() - 1, val.getMonth() + 1);
  }
  const s = String(val).trim();
  // Enforce DD/MM/YYYY — first part is always day when ambiguous
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let a = parseInt(m[1]), b = parseInt(m[2]);
    let y = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
    if (a > 12) return new Date(y, b - 1, a);       // DD/MM
    if (b > 12) return new Date(y, a - 1, b);       // MM/DD
    return new Date(y, a - 1, b);                   // ambiguous, assume MM/DD
  }
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function fmtDate(d) {
  if (!d) return '—';
  return String(d.getDate()).padStart(2,'0') + '/' +
         String(d.getMonth()+1).padStart(2,'0') + '/' +
         String(d.getFullYear()).slice(-2);
}

function addYears(date, n) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + n);
  return d;
}

function subtractOneMonth(date) {
  const d   = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() - 1);
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

// ─────────────────────────────────────────────────────────────────
// NAME NORMALIZATION
// ─────────────────────────────────────────────────────────────────
const NAME_PREFIXES = /^(mr\.?|mrs\.?|ms\.?)\s+/i;

function normalizeName(value, stripPrefixes) {
  let name = String(value || '').trim();
  if (stripPrefixes) name = name.replace(NAME_PREFIXES, '');
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────
// NUMBER & FORMAT UTILITIES
// ─────────────────────────────────────────────────────────────────
function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  const s = String(val).trim().split('(')[0].trim();
  return parseFloat(s.replace(/[^0-9.\-]/g, '')) || 0;
}

function parseInsuranceYears(val) {
  if (val === null || val === undefined || val === '') return 0;
  const s = String(val).toLowerCase().replace(/\s/g, '');
  if (s === '0' || s === '') return 0;
  const numStr = s.replace(/[^0-9.]/g, '');
  const n = parseFloat(numStr);
  if (isNaN(n) || n === 0) { if (s.includes('paid')) return 1; return 0; }
  if (n >= 4000) return 3;
  if (n >= 2500) return 2;
  if (n >= 1000) return 1;
  return 0;
}

function fmt(n)  { return Math.round(n).toLocaleString(); }

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─────────────────────────────────────────────────────────────────
// INSURANCE & DEDUCTION LOGIC
// ─────────────────────────────────────────────────────────────────
const NEW_INSURANCE_FROM = new Date(2026, 5, 30);   // 30 Jun 2026
const NEVER_PAID_FROM = new Date(2026, 2, 1);      // 1 Mar 2026

function isSpecialtyContainer(t) {
  const s = String(t || '').toUpperCase();
  return ['SPECIAL', 'OPEN', 'THERMAL', 'SIDE'].some(k => s.includes(k));
}

function insuranceAmount(containerType, firstPayout) {
  if (!firstPayout || firstPayout < NEW_INSURANCE_FROM) return 1500;
  if (isSpecialtyContainer(containerType)) return 2600;
  const s = String(containerType || '').toUpperCase();
  const is20 = s.includes('20') && !s.includes('40');
  return is20 ? 1500 : 1800;
}

function deductionBasis(firstPayout, restartDate) {
  if (!restartDate) return firstPayout;
  if (!firstPayout) return restartDate;
  const sameDay = firstPayout.getFullYear() === restartDate.getFullYear()
    && firstPayout.getMonth() === restartDate.getMonth()
    && firstPayout.getDate() === restartDate.getDate();
  if (sameDay || firstPayout >= NEVER_PAID_FROM) return restartDate;
  return firstPayout;
}

function calcDeduction(payoutDate, firstPayout, insuranceYearsCovered, isHealthCheckEligible, hcPendingFromRef, yr, mo, containerType, isRerouted) {
  if (!firstPayout) return { amount: 0, items: [] };

  function samePayoutMonth(d) {
    if (!d) return false;
    return d.getFullYear() === yr && d.getMonth() + 1 === mo;
  }

  const y1Date = new Date(firstPayout);
  const y2Date = subtractOneMonth(addYears(firstPayout, 1));
  const y3Date = addYears(firstPayout, 2);

  const items = [];

  // Rerouted clients always flat 1,500; new clients use size-based if first payout >= 30 Jun 2026
  const insAmt = isRerouted ? 1500 : insuranceAmount(containerType, firstPayout);
  if (insuranceYearsCovered < 1 && samePayoutMonth(y1Date)) items.push({ type: 'Y1 Insurance', amount: insAmt, firstPayout });
  if (insuranceYearsCovered < 2 && samePayoutMonth(y2Date)) items.push({ type: 'Y2 Insurance', amount: insAmt, firstPayout });
  if (insuranceYearsCovered < 3 && samePayoutMonth(y3Date)) items.push({ type: 'Y3 Insurance', amount: insAmt, firstPayout });

  const insuranceTotal = items.reduce((s, it) => s + it.amount, 0);

  if (isHealthCheckEligible) {
    const hc1 = new Date(firstPayout);
    const hc2 = subtractOneMonth(addYears(firstPayout, 1));
    const hc3 = addYears(firstPayout, 2);
    const hcDueThisCycle = samePayoutMonth(hc1) || samePayoutMonth(hc2) || samePayoutMonth(hc3);
    if (hcPendingFromRef)                          items.push({ type: 'HC',         amount: 1000, firstPayout, note: 'applied from previous payout' });
    else if (hcDueThisCycle && insuranceTotal > 0) items.push({ type: 'HC Pending', amount: 0,    firstPayout, note: 'pending — deduct next cycle' });
    else if (hcDueThisCycle)                       items.push({ type: 'HC',         amount: 1000, firstPayout });
  }

  return { amount: items.reduce((s, it) => s + it.amount, 0), items };
}

// ─────────────────────────────────────────────────────────────────
// GROUP ANALYSIS
// ─────────────────────────────────────────────────────────────────
function analyzeGroups(rows) {
  const groupMap = {};
  rows.forEach(r => {
    if (r.groupId === '__MANUAL_CHECK__') return;
    if (!groupMap[r.groupId]) groupMap[r.groupId] = { clients: new Set(), contractNos: new Set(), rows: [] };
    const ibanValid = r.iban && /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(r.iban.replace(/\s/g, ''));
    const clientKey = ibanValid ? r.iban.replace(/\s/g, '') : (r.accountNo || r.clientName);
    groupMap[r.groupId].clients.add(clientKey);
    groupMap[r.groupId].contractNos.add(r.contractNo || '__NONE__');
    groupMap[r.groupId].rows.push(r);
  });

  const EXCEPTIONS = new Set(['LGMU2266157','LGMU2279473','LGMU2272308','LGMU2271894','LGMU2276920','HKAU2024746']);
  const sharedGroups = {}, mismatchFlags = [];

  Object.entries(groupMap).forEach(([gid, meta]) => {
    const isContainerBased = meta.rows.some(r => r.container && r.container === gid);
    if (isContainerBased && meta.contractNos.size > 1 && !EXCEPTIONS.has(gid)) {
      mismatchFlags.push({ container: gid, contractNos: [...meta.contractNos].filter(c => c !== '__NONE__'), clientNames: [...meta.clients] });
    } else if (meta.clients.size > 1) {
      sharedGroups[gid] = meta;
    }
  });

  return { sharedGroups, mismatchFlags };
}

// ─────────────────────────────────────────────────────────────────
// EMAIL SHEET — shared by payout.js / ip-deduction.js integrated matching
// ─────────────────────────────────────────────────────────────────
function splitEmails(value) {
  const text = String(value || '').trim();
  if (!text) return ['', ''];
  const parts = text.split(/[,:;\s]+/).map(p => p.trim()).filter(Boolean);
  return [parts[0] || '', parts[1] || ''];
}

function buildEmailRecords() {
  const rows = emailData.slice(1);

  let lastEmail = '';
  let lastClientName = '';
  rows.forEach(row => {
    const e = row[15] != null ? String(row[15]).trim() : '';
    const clientName = String(row[0] || '').trim();
    if (clientName !== lastClientName) { lastEmail = ''; lastClientName = clientName; }
    if (e) lastEmail = e;
    else if (lastEmail) row[15] = lastEmail;
  });

  const grouped = new Map();
  rows.forEach(row => {
    const rawName    = String(row[0] || '').trim();
    const parenMatch = rawName.match(/\(([^)]+)\)/);
    const mainName   = rawName.replace(/\([^)]*\)/g, ' ').trim();
    const normName   = normalizeName(mainName || rawName, true);
    const normParen  = parenMatch ? normalizeName(parenMatch[1], true) : '';
    const emailRaw   = String(row[15] || '').trim();

    const record = {
      emailSheetClientName: rawName, normName, normParen,
      clientEmailRaw: emailRaw,
      mobile: String(row[16] || '').split(/[,;]+/)[0].replace(/\s+/g,'').trim(),
      nationality: row[17] != null ? String(row[17]).trim() : '',
      eid: row[18] != null ? String(row[18]).trim() : '',
    };

    if (!grouped.has(normName)) grouped.set(normName, record);
    if (normParen && !grouped.has(normParen)) grouped.set(normParen, record);
  });

  return Array.from(grouped.values());
}

function lookupEmailRecord(emailRecords, name) {
  if (!emailRecords.length) return null;
  const parenMatch = String(name || '').match(/\(([^)]+)\)/);
  const normParen  = parenMatch ? normalizeName(parenMatch[1], true) : '';
  const normOuter  = normalizeName(String(name || '').replace(/\([^)]*\)/g, ' ').trim(), true);
  const find = n => emailRecords.find(r => r.normName === n || r.normParen === n);
  return (normParen && find(normParen)) || find(normOuter) || null;
}

// ─────────────────────────────────────────────────────────────────
// REROUTE MAP BUILDER
// ─────────────────────────────────────────────────────────────────
function parseRerouteSheet(raw) {
  let hi = 0;
  for (let i = 0; i < Math.min(5, raw.length); i++) {
    if (raw[i] && raw[i].some(v => v && String(v).toLowerCase().includes('client name'))) { hi = i; break; }
  }
  const headers = (raw[hi] || []).map(h => h ? String(h).toLowerCase().trim() : '');
  const col = name => headers.findIndex(h => h.includes(name));
  const cName    = col('client name');
  const cCont    = col('container number');
  const cRental  = col('new rental');
  const cRestart = col('payout restart');
  const cCycle   = col('payout cycle');

  const byKey = {}, byCont = {}, byName = {};
  raw.slice(hi + 1).forEach(r => {
    if (!r) return;
    const name = (cName !== -1 && r[cName] != null) ? String(r[cName]).trim() : '';
    const cont = (cCont !== -1 && r[cCont] != null) ? String(r[cCont]).trim() : '';
    if (!name && !cont) return;
    const restartRaw = (cRestart !== -1 && r[cRestart] != null) ? String(r[cRestart]).trim() : '';
    const entry = {
      clientName:  name,
      container:   cont,
      newRental:   cRental  !== -1 ? parseNumber(r[cRental]) : 0,
      restartDate: cRestart !== -1 ? parseDate(r[cRestart])  : null,
      isFlexible:  /flex/i.test(restartRaw),
      cycle:       (cCycle !== -1 && r[cCycle] != null) ? String(r[cCycle]).trim() : '',
    };
    const nkey = normalizeName(name, false);
    byKey[cont + '||' + nkey] = entry;
    if (cont) (byCont[cont] = byCont[cont] || []).push(entry);
    if (nkey) (byName[nkey] = byName[nkey] || []).push(entry);
  });
  return { byKey, byCont, byName };
}

// ─────────────────────────────────────────────────────────────────
// REROUTE / NAME-VARIANT HELPERS — shared by payout.js / ip-deduction.js
// ─────────────────────────────────────────────────────────────────
function nameVariants(raw) {
  const s = String(raw || '');
  const m = s.match(/\(([^)]*)\)/);
  const out = [];
  if (m) { out.push(normalizeName(m[1], false)); out.push(normalizeName(s.replace(/\([^)]*\)/g, ''), false)); }
  out.push(normalizeName(s, false));
  return out.filter(Boolean);
}

function namesOverlap(a, b) {
  const A = nameVariants(a), B = nameVariants(b);
  return A.some(x => B.includes(x));
}

function rerouteFor(r) {
  if (!r || (!r.container && !r.clientName)) return null;
  if (r.pinFilledDown && !r.isSharedContainer) return null;
  const cont = r.container || '', nkey = normalizeName(r.clientName || '', false);
  const exact = rerouteMap.byKey[cont + '||' + nkey];
  if (exact) return { e: exact, contOk: true, nameOk: true };
  if (cont && rerouteMap.byCont[cont]) {
    const list = rerouteMap.byCont[cont];
    const pick = list.find(e => namesOverlap(r.clientName, e.clientName)) || list[0];
    return { e: pick, contOk: true, nameOk: namesOverlap(r.clientName, pick.clientName) };
  }
  for (const v of nameVariants(r.clientName)) {
    if (rerouteMap.byName[v]) return { e: rerouteMap.byName[v][0], contOk: false, nameOk: true };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// SHARED DEDUCTION ENGINE — used by payout.js (full) & ip-deduction.js
// Cycle is ALWAYS taken from the original payout cycle field — a
// reroute restart date never moves a client between 15th/EOM cycles.
// It only affects WHEN within the timeline insurance anniversaries land.
// ─────────────────────────────────────────────────────────────────
const WEIGHTED_SPLITS = {
  'CONMO0379':   { 'Mohamed Rafi Hakeem': 0.75, 'Sundarrajan Dharmarajan Dhayalakumaran': 0.25 },
  'CONRA181':    { 'Rashedur Rahman Chowdhury': 0.50, 'Reshad Abd Alim': 0.25, 'Adnan Amin Ziaul Amin': 0.25 },
  'CONMRTMN0529':{ 'Muhammad Rameez Tahir Muhammad Naeem': 0.3333, 'Muhammad Jawad Tahir': 0.3333, 'Muhammad Junaid Jamshaid Hafiz Jamshaid Akhtar': 0.3333 },
  'CONNU0415':   { 'Nuzhat Mursaleen Faisal Fakir Mohammed': 0.61, 'Barayil Porakandy Roshan Valiyakath Aboobacker': 0.39 },
};

function buildHcPendingMap() {
  const hcPendingMap = {};
  if (refData.length > 1) {
    const rh = refData[0].map(h => h ? String(h).toLowerCase().trim() : '');
    const ibanIdx = rh.findIndex(h => h.includes('iban'));
    const noteIdx = rh.findIndex(h => h.includes('note'));
    if (ibanIdx !== -1 && noteIdx !== -1) {
      refData.slice(1).forEach(r => {
        if (!r || !r[ibanIdx]) return;
        const iban = String(r[ibanIdx]).replace(/\s/g, '');
        const note = r[noteIdx] ? String(r[noteIdx]).toLowerCase() : '';
        if (iban && note.includes('hc')) hcPendingMap[iban] = true;
      });
    }
  }
  return hcPendingMap;
}

function filterRowsForCycle(rows, cycle, payoutDate) {
  return rows.filter(r => {
    if (r.pinFilledDown && !r.isSharedContainer) return false;
    const rr = rerouteFor(r);
    if (rr && rr.e.isFlexible) return false;       // flexible: skip
    if (rr && !rr.e.restartDate) return false;     // rerouted but no readable restart: skip
    // Cycle always comes from the original payout cycle field — restart date
    // never moves a client between 15th and EOM cycles.
    const c = String(r.payoutCycle).replace(/\s/g, '');
    const cycleMatch = cycle === '15' ? c === '15' : (c === '30/31' || c === '30' || c === '31');
    const restart  = rr ? rr.e.restartDate : null;
    const effStart = restart || r.firstPayout;
    const started  = !effStart || effStart <= payoutDate;
    return cycleMatch && started;
  });
}

function calcPayeeDeductions(filteredRows, yr, mo, payoutDate) {
  const hcCutoff = new Date(2025, 5, 30);
  const hcPendingMap = buildHcPendingMap();

  const clientHasContractEnd = {};
  filteredRows.forEach(r => {
    if (!clientHasContractEnd[r.clientName]) clientHasContractEnd[r.clientName] = false;
    if (r.contractEnd) clientHasContractEnd[r.clientName] = true;
  });

  const { sharedGroups, mismatchFlags } = analyzeGroups(filteredRows);
  const mismatchContainers = new Set(mismatchFlags.map(f => f.container));

  const groups = {};
  filteredRows.forEach(r => {
    const ibanValid = r.iban && /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(r.iban.replace(/\s/g, ''));
    const key       = (ibanValid ? r.iban.replace(/\s/g, '') : r.accountNo) || r.clientName;
    if (!groups[key]) {
      groups[key] = {
        index: r.index, clientName: r.clientName, iban: r.iban,
        accountNo: r.accountNo, swift: r.swift, bankName: r.bankName,
        clientType: r.clientType, containers: [],
        totalDeduction: 0, deductionItems: [], deductionNotes: [],
        agents: new Set(), firstPayout: r.firstPayout, rerouteDates: [],
      };
    }

    const g = groups[key];
    const rr = rerouteFor(r);
    const dedBasis = deductionBasis(r.firstPayout, (rr && rr.e.restartDate) ? rr.e.restartDate : null);
    g.containers.push(r.container);
    if (r.agent) g.agents.add(r.agent);
    if (rr && rr.e.restartDate) g.rerouteDates.push(fmtDate(rr.e.restartDate));
    if (rr && rr.contOk && !rr.nameOk) g.deductionNotes.push('⚑ Verify name — restart matched by container only');
    if (rr && !rr.contOk && rr.nameOk) g.deductionNotes.push('⚑ Verify container — restart matched by name only');

    if (r.contractClosedFlag) g.deductionNotes.push(r.contractClosedFlag);
    if (r.groupId === '__MANUAL_CHECK__') g.deductionNotes.push('⚑ No container or contract number — manual check required');
    if (r.noIban) g.deductionNotes.push('⚑ No IBAN and no account number — verify');
    if (r.clientTypeBlank) g.deductionNotes.push('⚑ Blank client type');

    const isCommission = r.container && r.container.toLowerCase() === 'commission';
    if (!isCommission) {
      if (!clientHasContractEnd[r.clientName]) {
        g.deductionNotes.push('⚑ No contract end date');
      } else if (r.contractEnd && r.contractEnd < new Date()) {
        g.deductionNotes.push('⚑ Contract end date has passed — verify');
      }
    }

    const isHcEligible = r.payReceived && r.payReceived <= hcCutoff;
    const cleanIban    = r.iban ? r.iban.replace(/\s/g, '') : '';
    const hcPending     = hcPendingMap[cleanIban] || false;

    if (r.container && mismatchContainers.has(r.container)) {
      const mf = mismatchFlags.find(f => f.container === r.container);
      g.deductionNotes.push(`⚑ Duplicate container mismatch — container ${r.container} appears under different contracts (${mf.contractNos.join(' / ')}) — manual check`);
      const ded = calcDeduction(payoutDate, dedBasis, r.insuranceYearsCovered, isHcEligible, hcPending, yr, mo, r.containerType, !!rr);
      g.totalDeduction += ded.amount;
      g.deductionItems.push(...ded.items);
    } else if (r.groupId !== '__MANUAL_CHECK__' && sharedGroups[r.groupId]) {
      const sg = sharedGroups[r.groupId];
      if (!sg.deductionCalculated) {
        const ded = calcDeduction(payoutDate, dedBasis, r.insuranceYearsCovered, isHcEligible, hcPending, yr, mo, r.containerType, !!rr);
        sg.deductionAmount = ded.amount; sg.deductionItems = ded.items; sg.deductionCalculated = true;
      }
      const contractKey = r.contractNo || [...sg.contractNos].find(c => c !== '__NONE__') || '';
      const weightMap   = WEIGHTED_SPLITS[contractKey];
      const clientShare = weightMap ? (weightMap[r.clientName] ?? (1 / sg.clients.size)) : (1 / sg.clients.size);
      const splitLabel  = weightMap ? Object.values(weightMap).map(v => Math.round(v * 100)).join('-') : `${sg.clients.size} ways`;
      const splitItems  = sg.deductionItems.map(it => ({ ...it, amount: it.amount * clientShare }));
      g.totalDeduction += sg.deductionAmount * clientShare;
      g.deductionItems.push(...splitItems);
      if (sg.deductionAmount > 0) g.deductionNotes.push(`⚑ Shared group ${r.groupId} — deduction split ${splitLabel}`);
    } else {
      const ded = calcDeduction(payoutDate, dedBasis, r.insuranceYearsCovered, isHcEligible, hcPending, yr, mo, r.containerType, !!rr);
      g.totalDeduction += ded.amount;
      g.deductionItems.push(...ded.items);
    }
  });

  // Finalize: build the deduction-only note string per group
  Object.values(groups).forEach(g => {
    const roundedDeduction = Math.round(g.totalDeduction);
    const y1Items   = g.deductionItems.filter(it => it.type === 'Y1 Insurance');
    const ipItems   = g.deductionItems.filter(it => it.type === 'Y2 Insurance' || it.type === 'Y3 Insurance');
    const hcApplied = g.deductionItems.filter(it => it.type === 'HC');
    const hcPendingItems = g.deductionItems.filter(it => it.type === 'HC Pending');
    const y1WithOthers = y1Items.length > 0 && ipItems.length > 0;

    const dedNotes = [];
    if (ipItems.length > 0) {
      const hasY1 = y1WithOthers, hasY2 = ipItems.some(it => it.type === 'Y2 Insurance'), hasY3 = ipItems.some(it => it.type === 'Y3 Insurance');
      const typeStr  = [hasY1 ? 'Y1' : null, hasY2 ? 'Y2' : null, hasY3 ? 'Y3' : null].filter(Boolean).join(' & ');
      const allItems = [...(y1WithOthers ? y1Items : []), ...ipItems];
      const totalAmt = Math.round(allItems.reduce((s, it) => s + it.amount, 0));
      const dates    = [...new Set(allItems.map(it => fmtDate(it.firstPayout)))];
      let ipNote = `${typeStr} IP ${totalAmt.toLocaleString()} from ${dates.join(' & ')}`;
      if (hcPendingItems.length > 0) ipNote += ' — HC pending next cycle';
      dedNotes.push(ipNote);
    } else if (hcPendingItems.length > 0) {
      dedNotes.push('HC pending next cycle');
    }
    if (hcApplied.length > 0) dedNotes.push('HC 1,000 applied — double-check the contract');

    const agentArr = [...g.agents];
    if (agentArr.length > 1) g.deductionNotes.push(`⚑ Multiple agents: ${agentArr.join(' / ')}`);
    g.agent = agentArr.length >= 1 ? agentArr[agentArr.length - 1] : '';

    const rerouteDateStr = (g.rerouteDates && g.rerouteDates.length)
      ? [...new Set(g.rerouteDates)].join(' & ') : '';
    const activeDates = [...new Set([...y1Items, ...ipItems, ...hcApplied].map(it => fmtDate(it.firstPayout)))];
    g.firstPayoutDisplay = rerouteDateStr || activeDates.join(' & ') || fmtDate(g.firstPayout) || '';

    g.totalDeduction = roundedDeduction;
    g.note = [...new Set(g.deductionNotes), ...dedNotes].join(' | ');
  });

  return { groups, sharedGroups, mismatchFlags };
}
