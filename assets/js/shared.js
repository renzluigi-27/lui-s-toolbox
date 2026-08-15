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
    return new Date(val.getFullYear(), val.getDate() - 1, val.getMonth() + 1);
  }
  const s = String(val).trim();
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let a = parseInt(m[1]), b = parseInt(m[2]);
    let y = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
    if (a > 12) return new Date(y, b - 1, a);
    if (b > 12) return new Date(y, a - 1, b);
    return new Date(y, a - 1, b);
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

function addMonths(date, n) {
  const d   = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
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
// PAYOUT FREQUENCY — Monthly / Quarterly / Yearly / Flexible
// ─────────────────────────────────────────────────────────────────
function normalizeFrequency(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('flexible')) return 'flexible';
  if (s.includes('quart'))    return 'quarterly';
  if (s.includes('yearly'))   return 'yearly';
  return 'monthly';
}

function monthsBetween(basisDate, targetDate) {
  if (!basisDate || !targetDate) return null;
  return (targetDate.getFullYear() - basisDate.getFullYear()) * 12
       + (targetDate.getMonth() - basisDate.getMonth());
}

function isDueThisCycle(frequency, basisDate, payoutDate) {
  if (frequency === 'monthly') return true;
  const diff = monthsBetween(basisDate, payoutDate);
  if (diff === null || diff < 0) return false;
  if (frequency === 'quarterly') return diff % 3 === 0;
  if (frequency === 'yearly')    return diff % 12 === 0;
  return true;
}

function frequencyMultiplier(frequency) {
  if (frequency === 'quarterly') return 3;
  if (frequency === 'yearly')    return 12;
  return 1;
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
const NEVER_PAID_FROM = new Date(2026, 2, 1);       // 1 Mar 2026

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

// ─────────────────────────────────────────────────────────────────
// REROUTED CLIENT ANNIVERSARY BASIS — war-related payout stoppage.
// Payouts stopped for rerouted clients; last payout actually received
// was 15 Feb 2026 (15th-cycle clients) or 28 Feb 2026 (EOM-cycle
// clients). IP/HC anniversaries must reflect months actually paid,
// not raw calendar time — the pause itself doesn't count toward the
// 12-month clock. Anchor: months actually paid (First Payout Date up
// to the last-received cutoff, inclusive) mod 12 gives progress into
// the in-flight year. The Restart Date payout is itself a real
// disbursement — same as First Payout Date counting as month 1 — so
// it fulfills one of the remaining months; only (remaining - 1) more
// months are needed after the restart to complete the cycle.
// ─────────────────────────────────────────────────────────────────
const LAST_PAYOUT_15TH = new Date(2026, 1, 15);   // 15 Feb 2026
const LAST_PAYOUT_EOM  = new Date(2026, 1, 28);   // 28 Feb 2026

function rerouteAnniversaryBasis(firstPayout, restartDate, payoutCycle) {
  if (!restartDate) return firstPayout;
  if (!firstPayout) return restartDate;
  const cycleStr  = String(payoutCycle || '').replace(/\s/g, '');
  const cutoff    = cycleStr.startsWith('15') ? LAST_PAYOUT_15TH : LAST_PAYOUT_EOM;
  const monthsPaid = Math.max(0, monthsBetween(firstPayout, cutoff) + 1); // inclusive of first-payout month
  // Restart Date payout covers the first of the remaining months, so only
  // (remaining - 1) more are needed after it. Always 0-11, no wrap needed.
  const monthsAfterRestart = 11 - (monthsPaid % 12);
  return addMonths(restartDate, monthsAfterRestart);
}

// ─────────────────────────────────────────────────────────────────
// IP + HC deduction. HC is deducted in the same cycle as IP when due —
// accounts no longer staggers them, so there is no "pending" state.
// ─────────────────────────────────────────────────────────────────
function calcDeduction(payoutDate, firstPayout, insuranceYearsCovered, isHealthCheckEligible, yr, mo, containerType, isRerouted) {
  if (!firstPayout) return { amount: 0, items: [] };

  function samePayoutMonth(d) {
    if (!d) return false;
    return d.getFullYear() === yr && d.getMonth() + 1 === mo;
  }

  const y1Date = new Date(firstPayout);
  const y2Date = addYears(firstPayout, 1);
  const y3Date = addYears(firstPayout, 2);

  const items = [];

  const insAmt = isRerouted ? 1500 : insuranceAmount(containerType, firstPayout);
  if (insuranceYearsCovered < 1 && samePayoutMonth(y1Date)) items.push({ type: 'Y1 Insurance', amount: insAmt, firstPayout });
  if (insuranceYearsCovered < 2 && samePayoutMonth(y2Date)) items.push({ type: 'Y2 Insurance', amount: insAmt, firstPayout });
  if (insuranceYearsCovered < 3 && samePayoutMonth(y3Date)) items.push({ type: 'Y3 Insurance', amount: insAmt, firstPayout });

  if (isHealthCheckEligible) {
    const hc1 = new Date(firstPayout);
    const hc2 = addYears(firstPayout, 1);
    const hc3 = addYears(firstPayout, 2);
    if (samePayoutMonth(hc1)) items.push({ type: 'HC', year: 'Y1', amount: 1000, firstPayout });
    else if (samePayoutMonth(hc2)) items.push({ type: 'HC', year: 'Y2', amount: 1000, firstPayout });
    else if (samePayoutMonth(hc3)) items.push({ type: 'HC', year: 'Y3', amount: 1000, firstPayout });
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
// GENERATION TIMESTAMP — used in export filenames across tools
// ─────────────────────────────────────────────────────────────────
function timestampTag() {
  const d = new Date();
  const dd  = String(d.getDate()).padStart(2, '0');
  const mmm = MONTHS[d.getMonth()].toUpperCase();
  const yyyy = d.getFullYear();
  const hh  = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss  = String(d.getSeconds()).padStart(2, '0');
  return `${dd}${mmm}${yyyy}_${hh}${min}${ss}`;
}

// ─────────────────────────────────────────────────────────────────
// ACCOUNTS PAYOUT LIST — optional upload for Payout Generator / IP
// Deduction to sort output rows in the same order as the accounts
// team's file. Matching precedence mirrors the rest of the toolbox:
// IBAN -> Account No -> Name (parentheses-first). Kept independent
// from payout-audit.js so its own matching logic stays untouched.
// ─────────────────────────────────────────────────────────────────
const ACCOUNTS_ORDER_SYN = {
  name:    ['client name', 'name'],
  account: ['account no', 'account number', 'account', 'acc no'],
  iban:    ['iban no', 'iban', 'iban number'],
};

function buildAccountsOrderIndex(sheetsAOA) {
  const index = { byIban: {}, byAccount: {}, byName: {} };
  let order = 0;
  sheetsAOA.forEach(aoa => {
    let headerRowIdx = -1, map = {};
    for (let i = 0; i < Math.min(aoa.length, 10); i++) {
      const row = (aoa[i] || []).map(c => normalizeName(c, false));
      if (row.includes('client name') || row.includes('name')) {
        headerRowIdx = i;
        Object.keys(ACCOUNTS_ORDER_SYN).forEach(field => {
          for (let c = 0; c < row.length; c++) {
            if (ACCOUNTS_ORDER_SYN[field].includes(row[c])) { map[field] = c; break; }
          }
        });
        break;
      }
    }
    if (headerRowIdx < 0) return;
    for (let i = headerRowIdx + 1; i < aoa.length; i++) {
      const raw = aoa[i] || [];
      if (!raw.some(c => c != null && String(c).trim() !== '')) continue;

      const name    = map.name    != null ? raw[map.name]    : null;
      const account = map.account != null ? raw[map.account] : null;
      const iban    = map.iban    != null ? raw[map.iban]    : null;
      const ibanKey = iban ? String(iban).replace(/\s/g, '').toUpperCase() : '';
      const accKey  = account ? String(account).trim() : '';
      const nameStr = name ? String(name).trim() : '';
      if (!ibanKey && !accKey && !nameStr) continue;

      if (ibanKey && !(ibanKey in index.byIban)) index.byIban[ibanKey] = order;
      if (accKey && !(accKey in index.byAccount)) index.byAccount[accKey] = order;
      if (nameStr) {
        const parenMatch = nameStr.match(/\(([^)]+)\)/);
        const mainName   = nameStr.replace(/\([^)]*\)/g, ' ').trim();
        const normMain   = normalizeName(mainName || nameStr, true);
        const normParen  = parenMatch ? normalizeName(parenMatch[1], true) : '';
        if (normMain && !(normMain in index.byName)) index.byName[normMain] = order;
        if (normParen && !(normParen in index.byName)) index.byName[normParen] = order;
      }
      order++;
    }
  });
  return index;
}

function lookupAccountsOrder(index, iban, accountNo, clientName) {
  const ibanKey = iban ? String(iban).replace(/\s/g, '').toUpperCase() : '';
  if (ibanKey && ibanKey in index.byIban) return index.byIban[ibanKey];

  const accKey = accountNo ? String(accountNo).trim() : '';
  if (accKey && accKey in index.byAccount) return index.byAccount[accKey];

  const nameStr = clientName ? String(clientName).trim() : '';
  if (nameStr) {
    const parenMatch = nameStr.match(/\(([^)]+)\)/);
    const mainName   = nameStr.replace(/\([^)]*\)/g, ' ').trim();
    const normMain   = normalizeName(mainName || nameStr, true);
    const normParen  = parenMatch ? normalizeName(parenMatch[1], true) : '';
    if (normMain && normMain in index.byName) return index.byName[normMain];
    if (normParen && normParen in index.byName) return index.byName[normParen];
  }
  return null; // unmatched — sorts to the end
}

// results: array of {index, iban, accountNo, clientName, ...}
// sheetsAOA: array of per-sheet AOA arrays from the uploaded Accounts
// Payout List, or null/empty if none uploaded (falls back to the
// Payment Info Sheet's own row order, same as before this feature).
function sortResultsByAccountsOrder(results, sheetsAOA) {
  if (!sheetsAOA || !sheetsAOA.length) {
    results.sort((a, b) => a.index - b.index);
    return results;
  }
  const idx = buildAccountsOrderIndex(sheetsAOA);
  results.forEach(r => {
    r._acctOrder = lookupAccountsOrder(idx, r.iban, r.accountNo, r.clientName);
  });
  results.sort((a, b) => {
    const oa = a._acctOrder == null ? Infinity : a._acctOrder;
    const ob = b._acctOrder == null ? Infinity : b._acctOrder;
    if (oa !== ob) return oa - ob;
    return String(a.clientName).localeCompare(String(b.clientName));
  });
  return results;
}

// ─────────────────────────────────────────────────────────────────
// EMAIL SHEET — shared by payout-schedule.js's own client-email lookup
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
// REROUTE HELPERS
// ─────────────────────────────────────────────────────────────────
function isNeverPaidDate(d) {
  if (!d) return false;
  const mo = d.getMonth() + 1;
  const dy = d.getDate();
  return (mo === 3 && (dy === 15 || dy === 30)) || (mo === 4 && dy === 15);
}

// ─────────────────────────────────────────────────────────────────
// SHARED DEDUCTION ENGINE — used by payout.js (full) & ip-deduction.js
// Rerouted clients: cycle derived from restartDate [LMC] day-of-month.
// Non-rerouted: original payout cycle field from payment info sheet.
// Frequency (quarterly/yearly) no longer gates whether a client appears
// this cycle — every client shows every cycle; a note flags the frequency
// so accounts can verify the rental amount manually (see calcPayeeDeductions).
// ─────────────────────────────────────────────────────────────────
const WEIGHTED_SPLITS = {
  'CONMO0379':   { 'Mohamed Rafi Hakeem': 0.75, 'Sundarrajan Dharmarajan Dhayalakumaran': 0.25 },
  'CONRA181':    { 'Rashedur Rahman Chowdhury': 0.50, 'Reshad Abd Alim': 0.25, 'Adnan Amin Ziaul Amin': 0.25 },
  'CONMRTMN0529':{ 'Muhammad Rameez Tahir Muhammad Naeem': 0.3333, 'Muhammad Jawad Tahir': 0.3333, 'Muhammad Junaid Jamshaid Hafiz Jamshaid Akhtar': 0.3333 },
  'CONNU0415':   { 'Nuzhat Mursaleen Faisal Fakir Mohammed': 0.63, 'Barayil Porakandy Roshan Valiyakath Aboobacker': 0.37 },
};

function filterRowsForCycle(rows, cycle, payoutDate) {
  return rows.filter(r => {
    if (r.pinFilledDown && !r.isSharedContainer) return false;
    if (r.isFlexible) return false;
    if (r.isRerouted && !r.restartDate) return false;

    // Hardcoded quarterly override — only include the cycle this container
    // is actually due (quarterly from its basis date, e.g. Oct 2026).
    if (r.isHardcodedQuarterly && !isDueThisCycle('quarterly', r.quarterlyBasis, payoutDate)) return false;

    let c;
    if (r.isRerouted) {
      c = r.restartDate.getDate() <= 15 ? '15' : '30';
    } else {
      c = String(r.payoutCycle).replace(/\s/g, '');
    }

    const cycleMatch = cycle === '15' ? c === '15' : (c === '30/31' || c === '30' || c === '31');
    const effStart   = r.isRerouted ? r.restartDate : r.firstPayout;
    const started    = !effStart || effStart <= payoutDate;

    const freq = normalizeFrequency(r.frequency);
    if (freq === 'flexible') return false;

    return cycleMatch && started;
  });
}

function calcPayeeDeductions(filteredRows, yr, mo, payoutDate) {
  const hcCutoff = new Date(2025, 5, 30);

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
    g.totalContainerCount = (g.totalContainerCount || 0) + 1;
    if (r.isTerminated) {
      g.terminatedContainerCount = (g.terminatedContainerCount || 0) + 1;
      return; // excluded from money calc entirely — counted above only
    }
    g.containers.push(r.container);
    if (r.agent) g.agents.add(r.agent);

    if (r.isRerouted && r.restartDate) g.rerouteDates.push(fmtDate(r.restartDate));

    if (r.contractClosedFlag) g.deductionNotes.push(r.contractClosedFlag);
    if (r.groupId === '__MANUAL_CHECK__') g.deductionNotes.push('⚑ No container or contract number — manual check required');

    const isCommission = r.container && r.container.toLowerCase() === 'commission';
    if (!isCommission) {
      const effectiveContractEnd = (r.isRerouted && r.newContractEnd) ? r.newContractEnd : r.contractEnd;
      if (effectiveContractEnd && effectiveContractEnd < new Date()) {
        g.deductionNotes.push('⚑ Contract end date has passed — verify');
      }
    }

    const freq = normalizeFrequency(r.frequency);
    if (freq === 'quarterly' || freq === 'yearly') {
      g.deductionNotes.push(`⚑ ${freq === 'yearly' ? 'Yearly' : 'Quarterly'} payout — verify rental amount with accounts`);
    }
    if (r.isYearlyPending) {
      g.deductionNotes.push('⚑ Yearly payout — start date not yet confirmed, verify with accounts');
    }

    const dedBasis = r.isRerouted
      ? rerouteAnniversaryBasis(r.firstPayout, r.restartDate, r.payoutCycle)
      : r.firstPayout;

    const isHcEligible = r.payReceived && r.payReceived <= hcCutoff;

    if (r.groupId !== '__MANUAL_CHECK__' && sharedGroups[r.groupId]) {
      const sg = sharedGroups[r.groupId];
      if (!sg.deductionCalculated) {
        const ded = calcDeduction(payoutDate, dedBasis, r.insuranceYearsCovered, isHcEligible, yr, mo, r.containerType, r.isRerouted);
        ded.items.forEach(it => { it.container = r.container; });
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
      const ded = calcDeduction(payoutDate, dedBasis, r.insuranceYearsCovered, isHcEligible, yr, mo, r.containerType, r.isRerouted);
      ded.items.forEach(it => { it.container = r.container; });
      g.totalDeduction += ded.amount;
      g.deductionItems.push(...ded.items);
    }
  });

  Object.values(groups).forEach(g => {
    g.allTerminated = g.totalContainerCount > 0 && g.terminatedContainerCount === g.totalContainerCount;
    if (g.allTerminated) {
      g.deductionNotes.push('⚑ All containers marked for termination — no payout this cycle');
    } else if (g.terminatedContainerCount) {
      g.deductionNotes.push(`⚑ ${g.terminatedContainerCount} of ${g.totalContainerCount} container(s) marked for termination — excluded from this payout`);
    }

    const roundedDeduction = Math.round(g.totalDeduction);
    const y1Items        = g.deductionItems.filter(it => it.type === 'Y1 Insurance');
    const ipItems        = g.deductionItems.filter(it => it.type === 'Y2 Insurance' || it.type === 'Y3 Insurance');
    const hcApplied      = g.deductionItems.filter(it => it.type === 'HC');

    // Accounts-style note, grouped by label (IP / HC / IP & HC) with a
    // single running total and the list of containers it covers — avoids
    // one line per container when several containers deduct this cycle.
    const byContainer = {};       // flat totals per container — used by payout.js for rent-capping
    const byContainerYear = {};   // nested by year — used only for note labeling below
    g.deductionItems.forEach(it => {
      const c = it.container || '—';
      const year = it.type === 'HC' ? it.year : it.type.slice(0, 2); // 'Y1'/'Y2'/'Y3'

      if (!byContainer[c]) byContainer[c] = { ip: 0, hc: 0 };
      if (!byContainerYear[c]) byContainerYear[c] = {};
      if (!byContainerYear[c][year]) byContainerYear[c][year] = { ip: 0, hc: 0 };

      if (it.type === 'HC') {
        byContainer[c].hc += it.amount;
        byContainerYear[c][year].hc += it.amount;
      } else {
        byContainer[c].ip += it.amount; // Y1/Y2/Y3 Insurance
        byContainerYear[c][year].ip += it.amount;
      }
    });

    // Exposed so payout.js can cap deductions at that cycle's rent and
    // carry any remainder forward per container — shared.js itself stays
    // rent-agnostic (IP Deduction tool uses the uncapped totals below).
    g.dedByContainer = byContainer;

    const labelGroups = {};
    Object.entries(byContainerYear).forEach(([container, years]) => {
      Object.entries(years).forEach(([year, amt]) => {
        if (amt.ip <= 0 && amt.hc <= 0) return;
        const kind = amt.ip > 0 && amt.hc > 0 ? 'IP & HC' : (amt.hc > 0 ? 'HC' : 'IP');
        const label = year === 'Y1' ? 'IP' : `${year} ${kind}`; // Y1 stays plain "IP"
        if (!labelGroups[label]) labelGroups[label] = { total: 0, containers: [] };
        labelGroups[label].total += Math.round(amt.ip + amt.hc);
        labelGroups[label].containers.push(container);
      });
    });

    const dedNotes = Object.entries(labelGroups).map(([label, lg]) =>
      `${lg.total.toLocaleString()}AED total deduction for ${label} | ${lg.containers.join(', ')}`
    );

    const agentArr = [...g.agents];
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
