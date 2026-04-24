// ─────────────────────────────────────────────────────────────────
// AIO TOOL — aio-tool.js
// Payout Generator · IP Deduction · Container Info · Email Matcher
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────
let paymentData   = [];
let refData       = [];
let emailData     = [];
let results       = [];
let activeMode    = 'payout';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const PREVIEW_COUNT = 10;

// ─────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────
(function init() {
  const now = new Date();
  const yearSel = document.getElementById('selYear');
  for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    if (y === now.getFullYear()) o.selected = true;
    yearSel.appendChild(o);
  }
  document.getElementById('selMonth').value = now.getMonth() + 1;
  updateTabUI();
  document.getElementById('selMonth').addEventListener('change', updateRefHint);
  document.getElementById('selCycle').addEventListener('change', updateRefHint);
  document.getElementById('selYear').addEventListener('change', updateRefHint);
})();

// ─────────────────────────────────────────────────────────────────
// MOBILE OVERLAY
// ─────────────────────────────────────────────────────────────────
if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
  const overlay = document.createElement('div');
  overlay.className = 'mobile-overlay';
  overlay.innerHTML = `
    <div style="font-size:48px;margin-bottom:1rem;">💻</div>
    <div style="font-size:20px;font-weight:600;color:var(--text);margin-bottom:0.5rem;">Desktop Recommended</div>
    <div style="font-size:14px;color:var(--text-muted);margin-bottom:1.5rem;max-width:280px;line-height:1.6;">
      This tool is best viewed on a PC or laptop.
    </div>
    <button onclick="history.back()" style="padding:0 24px;height:42px;font-size:14px;background:var(--text);color:var(--bg);border:none;border-radius:8px;cursor:pointer;">
      ← Go Back
    </button>
  `;
  document.body.appendChild(overlay);
}

// ─────────────────────────────────────────────────────────────────
// TAB SWITCHING
// ─────────────────────────────────────────────────────────────────
document.querySelectorAll('.mode-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    activeMode = btn.dataset.mode;
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    updateTabUI();
    clearResults();
    resetRefUpload();
  });
});

function updateTabUI() {
  document.getElementById('emailSheetCard').style.display =
    activeMode === 'email' ? 'block' : 'none';
  updateRefHint();
  updateGenerateBtn();
}

function updateRefHint() {
  const expected = getExpectedRefFilename();
  document.getElementById('refExpected').textContent = expected ? `e.g. ${expected}` : '—';
  const hints = {
    payout:    'Upload the previous cycle\'s payout export to auto-detect pending HC deductions.',
    ip:        'Upload the previous cycle\'s IP Deduction export for reference.',
    container: 'Upload the previous cycle\'s Container Info export for reference.',
    email:     'Upload the previous cycle\'s Email Matcher export to carry over missing contacts.',
  };
  document.getElementById('refHint').textContent = hints[activeMode] || '';
}

function getExpectedRefFilename() {
  const mo    = parseInt(document.getElementById('selMonth').value);
  const yr    = parseInt(document.getElementById('selYear').value);
  const cycle = document.getElementById('selCycle').value;
  const cycleTag = cycle === '15' ? '15' : '30';
  const prevDate  = new Date(yr, mo - 2, 1);
  const prevMonth = MONTHS[prevDate.getMonth()].toUpperCase();
  const prevYear  = prevDate.getFullYear();
  const prefixes = { payout:'PAYOUT', ip:'IP_DEDUCTION', container:'CONTAINER_INFO', email:'EMAIL_MATCHER' };
  return `${prefixes[activeMode]}_${cycleTag}_${prevMonth}${prevYear}.xlsx`;
}

function getExpectedOutputFilename() {
  const mo    = parseInt(document.getElementById('selMonth').value);
  const yr    = parseInt(document.getElementById('selYear').value);
  const cycle = document.getElementById('selCycle').value;
  const cycleTag = cycle === '15' ? '15' : '30';
  const monthStr = MONTHS[mo - 1].toUpperCase();
  const prefixes = { payout:'PAYOUT', ip:'IP_DEDUCTION', container:'CONTAINER_INFO', email:'EMAIL_MATCHER' };
  return `${prefixes[activeMode]}_${cycleTag}_${monthStr}${yr}.xlsx`;
}

function clearResults() {
  results = [];
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('genError').className = 'msg';
}

function resetRefUpload() {
  refData = [];
  const zone = document.getElementById('refUploadZone');
  zone.classList.remove('dragover');
  document.getElementById('refFileLoaded').classList.remove('show');
  document.getElementById('refLoadedName').textContent = '—';
  document.getElementById('refLoadedMeta').textContent = '—';
  document.getElementById('refFileInput').value = '';
  showMsg('refError', '');
}

function updateGenerateBtn() {
  const hasPayment = paymentData.length > 0;
  const hasEmail   = emailData.length > 0;
  const ready      = hasPayment && (activeMode !== 'email' || hasEmail);
  document.getElementById('generateBtn').disabled = !ready;
  document.getElementById('generateHint').textContent = ready
    ? 'Ready to generate'
    : hasPayment && activeMode === 'email'
      ? 'Upload email sheet to continue'
      : 'Upload payment info sheet to continue';
}

// ─────────────────────────────────────────────────────────────────
// FILE UPLOAD — payment info sheet
// ─────────────────────────────────────────────────────────────────
const uploadZone = document.getElementById('uploadZone');
uploadZone.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleMainFile(e.dataTransfer.files[0]);
});
document.getElementById('fileInput').addEventListener('change', e => {
  if (e.target.files[0]) handleMainFile(e.target.files[0]);
});

function handleMainFile(file) {
  showMsg('fileError', '');
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    showMsg('fileError', 'Please upload an Excel file (.xlsx or .xls)', 'error'); return;
  }
  readExcel(file, rows => {
    paymentData = parsePaymentSheet(rows);
    document.getElementById('fileLoaded').classList.add('show');
    document.getElementById('loadedName').textContent = file.name;
    document.getElementById('loadedMeta').textContent = `${paymentData.length} rows loaded`;
    updateGenerateBtn();
    clearResults();
  }, err => showMsg('fileError', 'Error reading file: ' + err, 'error'));
}

// ─────────────────────────────────────────────────────────────────
// FILE UPLOAD — reference (optional)
// ─────────────────────────────────────────────────────────────────
const refZone = document.getElementById('refUploadZone');
refZone.addEventListener('dragover',  e => { e.preventDefault(); refZone.classList.add('dragover'); });
refZone.addEventListener('dragleave', () => refZone.classList.remove('dragover'));
refZone.addEventListener('drop', e => {
  e.preventDefault(); refZone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleRefFile(e.dataTransfer.files[0]);
});
document.getElementById('refFileInput').addEventListener('change', e => {
  if (e.target.files[0]) handleRefFile(e.target.files[0]);
});

function handleRefFile(file) {
  showMsg('refError', '');
  if (!file.name.match(/\.xlsx$/i)) {
    showMsg('refError', 'Reference file must be .xlsx', 'error'); return;
  }
  const expected = getExpectedRefFilename();
  const prefixes = { payout:'PAYOUT_', ip:'IP_DEDUCTION_', container:'CONTAINER_INFO_', email:'EMAIL_MATCHER_' };
  const prefix   = prefixes[activeMode];
  const baseName = file.name.replace(/\.xlsx$/i, '').toUpperCase();
  if (!baseName.startsWith(prefix)) {
    showMsg('refError', `Wrong file. Expected a file starting with "${prefix}" — e.g. ${expected}`, 'error'); return;
  }
  if (file.name.toUpperCase() !== expected.toUpperCase()) {
    showMsg('refError', `⚠ Expected ${expected} but got ${file.name} — loaded anyway`, 'warn');
  }
  readExcel(file, rows => {
    refData = rows;
    document.getElementById('refFileLoaded').classList.add('show');
    document.getElementById('refLoadedName').textContent = file.name;
    document.getElementById('refLoadedMeta').textContent = `${rows.length - 1} reference rows loaded`;
  }, err => showMsg('refError', 'Error reading reference file: ' + err, 'error'));
}

// ─────────────────────────────────────────────────────────────────
// FILE UPLOAD — email sheet (mode 4 only)
// ─────────────────────────────────────────────────────────────────
const emailZone = document.getElementById('emailUploadZone');
emailZone.addEventListener('dragover',  e => { e.preventDefault(); emailZone.classList.add('dragover'); });
emailZone.addEventListener('dragleave', () => emailZone.classList.remove('dragover'));
emailZone.addEventListener('drop', e => {
  e.preventDefault(); emailZone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleEmailFile(e.dataTransfer.files[0]);
});
document.getElementById('emailFileInput').addEventListener('change', e => {
  if (e.target.files[0]) handleEmailFile(e.target.files[0]);
});

function handleEmailFile(file) {
  showMsg('emailError', '');
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    showMsg('emailError', 'Please upload an Excel file (.xlsx or .xls)', 'error'); return;
  }
  readExcel(file, rows => {
    emailData = rows;
    document.getElementById('emailFileLoaded').classList.add('show');
    document.getElementById('emailLoadedName').textContent = file.name;
    updateGenerateBtn();
  }, err => showMsg('emailError', 'Error reading email file: ' + err, 'error'));
}

// ─────────────────────────────────────────────────────────────────
// EXCEL READER
// ─────────────────────────────────────────────────────────────────
function readExcel(file, onSuccess, onError) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false, dateNF: 'dd/mm/yyyy' });
      onSuccess(rows);
    } catch(ex) { onError(ex.message); }
  };
  reader.onerror = () => onError('File read error');
  reader.readAsArrayBuffer(file);
}

// ─────────────────────────────────────────────────────────────────
// PARSE PAYMENT INFO SHEET — shared by all modes
// ─────────────────────────────────────────────────────────────────
function parsePaymentSheet(raw) {
  let hi = 0;
  for (let i = 0; i < Math.min(5, raw.length); i++) {
    if (raw[i] && raw[i].some(v => v && String(v).toLowerCase().includes('client name'))) { hi = i; break; }
  }
  const headers = raw[hi].map(h => h ? String(h).toLowerCase().trim() : '');
  const col = name => headers.findIndex(h => h.includes(name));

  const C = {
    clientName:     col('client name'),
    insurance:      col('insurance paid'),
    healthCheck:    col('health check'),
    payReceived:    col('payment received date'),
    container:      col('product identification number'),
    returnAmt:      col('return amount'),
    firstPayout:    col('first payout date'),
    payoutCycle:    col('payout cycle'),
    contractEnd:    col('contract end date'),
    accountNo:      col('account no'),
    iban:           col('iban'),
    swift:          col('swift code'),
    bankName:       col('bank name'),
    clientType:     col('client type'),
    contractNo:     col('contract no'),
    contractClosed: col('contract closed'),
    balance:        col('balance amount pending'),
    containerType:  16,   // col Q
    agent:          37,   // col AL
    company:        col('company'),
    totalTrips:     36,   // col AK
    payCalcStart:   col('payout calculation start date'),
  };

  const today = new Date(); today.setHours(0,0,0,0);

  // Fill-down trackers
  let lastContractNo    = '';
  let lastContainer     = '';
  let lastClientName    = '';
  let lastPayoutCycle   = '';
  let lastClientType    = '';
  let lastContainerType = '';

  const rows = [];

  for (let i = hi + 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r) continue;

    // ── Contract No fill-down ──
    let rawContractNo = '';
    if (C.contractNo !== -1 && r[C.contractNo]) rawContractNo = String(r[C.contractNo]).trim();
    else if (r[0]) rawContractNo = String(r[0]).trim();

    const NO_FILLDOWN_CLIENTS = new Set(['Jasem Mohammed Saif Mohamed Almehrzi']);
    const isNoNumber    = rawContractNo.toLowerCase() === 'no number';
    const clientNameRaw = r[C.clientName] ? String(r[C.clientName]).trim() : lastClientName;
    if (rawContractNo && !(isNoNumber && NO_FILLDOWN_CLIENTS.has(clientNameRaw))) lastContractNo = rawContractNo;
    const contractNo = lastContractNo;

    // ── Container fill-down ──
    let rawContainer = (C.container !== -1 && r[C.container]) ? String(r[C.container]).trim() : '';
    if (rawContainer) lastContainer = rawContainer;
    else rawContainer = lastContainer;
    const container = rawContainer;

    // ── Client Name fill-down ──
    let rawClientName = r[C.clientName] ? String(r[C.clientName]).trim() : '';
    if (rawClientName) lastClientName = rawClientName;
    else rawClientName = lastClientName;
    const clientName = rawClientName;

    if (!clientName) continue;

    // ── Skip non-LMC rows ──
    const companyVal = (C.company !== -1 && r[C.company]) ? String(r[C.company]).trim().toLowerCase() : '';
    if (companyVal && companyVal !== 'lmc') continue;
    
    // ── Payout cycle fill-down (no flag generated, just fill) ──
    const rawCycleDirect = (C.payoutCycle !== -1 && r[C.payoutCycle]) ? String(r[C.payoutCycle]).trim() : '';
    if (rawCycleDirect) lastPayoutCycle = rawCycleDirect;
    const payoutCycle = rawCycleDirect || lastPayoutCycle;

    // ── Client Type — flag if blank, fill-down for value ──
    const rawClientType = (C.clientType !== -1 && r[C.clientType]) ? String(r[C.clientType]).trim() : '';
    const clientTypeBlank = !rawClientType;   // PATCH: flag blank, not fill-down
    if (rawClientType) lastClientType = rawClientType;
    const clientType = rawClientType || lastClientType;

    // ── Container Type — flag if blank, fill-down for value ──
    const rawContainerType = (C.containerType !== -1 && r[C.containerType]) ? String(r[C.containerType]).trim() : '';
    const containerTypeBlank = !rawContainerType;   // PATCH: flag blank, not fill-down
    if (rawContainerType) lastContainerType = rawContainerType;
    const containerType = rawContainerType || lastContainerType;

    // ── Contract Closed ──
    const closedRaw = (C.contractClosed !== -1 && r[C.contractClosed])
      ? String(r[C.contractClosed]).toLowerCase().trim() : '';
    const SKIP_CLOSED = ['duplicate entry', 'closed', 'yes', 'contract closed'];
    if (closedRaw && SKIP_CLOSED.some(s => closedRaw.includes(s))) continue;
    const contractClosedFlag = closedRaw && !SKIP_CLOSED.some(s => closedRaw.includes(s))
      ? `⚑ Contract Closed field: "${r[C.contractClosed]}" — review` : '';

    // ── Dates — contractEnd is direct read only, no fill-down ──
    const firstPayout  = parseDate(r[C.firstPayout]);
    const payReceived  = parseDate(r[C.payReceived]);
    const contractEnd  = (C.contractEnd !== -1 && r[C.contractEnd]) ? parseDate(r[C.contractEnd]) : null;
    const payCalcStart = (C.payCalcStart !== -1 && r[C.payCalcStart]) ? parseDate(r[C.payCalcStart]) : null;

    // ── IBAN / Account ──
    let iban      = r[C.iban]      ? String(r[C.iban]).trim()      : '';
    let accountNo = r[C.accountNo] ? String(r[C.accountNo]).trim() : '';
    if (accountNo && accountNo.includes('E+')) accountNo = Number(accountNo).toLocaleString('fullwide', {useGrouping:false});
    if (iban      && iban.includes('E+'))      iban      = Number(iban).toLocaleString('fullwide', {useGrouping:false});
    const noIban = !iban && !accountNo;

    // ── Total Trips — direct read, no fill-down ──
    const totalTripsRaw = (C.totalTrips !== -1 && r[C.totalTrips] != null)
      ? parseInt(String(r[C.totalTrips]).trim()) : null;
    const totalTrips = (totalTripsRaw !== null && !isNaN(totalTripsRaw)) ? totalTripsRaw : null;

    // ── Return Amount + Flexible detection ──
    // PATCH: strip parenthetical note before numeric parsing (e.g. "4307 (1172.61$)" → "4307")
    const returnRaw  = (C.returnAmt !== -1 && r[C.returnAmt]) ? String(r[C.returnAmt]).trim() : '';
    const returnBase = returnRaw.split('(')[0].trim();
    const returnNum  = parseFloat(returnBase.replace(/[^0-9.\-]/g, ''));
    const isFlexible = /\d+%/.test(returnRaw) || (!isNaN(returnNum) && returnNum > 0 && returnNum < 1);
    const returnAmt  = isFlexible ? 0 : parseNumber(r[C.returnAmt]);

    const insuranceRaw          = r[C.insurance];
    const insuranceYearsCovered = parseInsuranceYears(insuranceRaw);
    const rawAgent              = r[C.agent] ? String(r[C.agent]).trim() : '';
    const balanceNote           = (C.balance !== -1 && r[C.balance]) ? String(r[C.balance]).trim() : '';

    // ── Group ID ──
    const noNumber = (s) => !s || s.toLowerCase() === 'no number' || s === '';
    let groupId;
    if (!noNumber(contractNo) && !noNumber(container)) groupId = contractNo + '|' + container;
    else if (!noNumber(contractNo)) groupId = contractNo;
    else if (!noNumber(container))  groupId = container;
    else groupId = '__MANUAL_CHECK__';

    rows.push({
      index: i,
      clientName,
      contractNo,
      groupId,
      insuranceYearsCovered,
      payReceived,
      payCalcStart,
      container,
      containerType,
      containerTypeBlank,   // PATCH: renamed from containerTypeFilledDown
      returnAmt,
      returnRaw,
      isFlexible,
      firstPayout,
      payoutCycle,
      contractEnd,
      accountNo,
      iban,
      swift:         r[C.swift]    ? String(r[C.swift]).trim()    : '',
      bankName:      r[C.bankName] ? String(r[C.bankName]).trim() : '',
      clientType,
      clientTypeBlank,      // PATCH: renamed from clientTypeFilledDown
      contractClosedFlag,
      balanceNote,
      noIban,
      totalTrips,
      agent: rawAgent,
    });
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────
// GENERATE — dispatcher
// ─────────────────────────────────────────────────────────────────
function runGenerate() {
  if (!paymentData.length) { showMsg('genError', 'Please upload the payment info sheet first.', 'error'); return; }
  showMsg('genError', '');
  clearResults();
  const yr    = parseInt(document.getElementById('selYear').value);
  const mo    = parseInt(document.getElementById('selMonth').value);
  const cycle = document.getElementById('selCycle').value;
  if      (activeMode === 'payout')    runPayout(yr, mo, cycle);
  else if (activeMode === 'ip')        runIPDeduction(yr, mo, cycle);
  else if (activeMode === 'container') runContainerInfo(yr, mo, cycle);
  else if (activeMode === 'email')     runEmailMatcher(yr, mo, cycle);
}

// ─────────────────────────────────────────────────────────────────
// EXPORT — dispatcher
// ─────────────────────────────────────────────────────────────────
function exportResults() {
  if (!results.length) return;
  if      (activeMode === 'payout')    exportPayout();
  else if (activeMode === 'ip')        exportIPDeduction();
  else if (activeMode === 'container') exportContainerInfo();
  else if (activeMode === 'email')     exportEmailMatcher();
}

// ─────────────────────────────────────────────────────────────────
// INSURANCE YEARS COVERED
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// DEDUCTION SCHEDULE
// ─────────────────────────────────────────────────────────────────
function calcDeduction(payoutDate, firstPayout, insuranceYearsCovered, isHealthCheckEligible, hcPendingFromRef, yr, mo) {
  if (!firstPayout) return { amount: 0, items: [] };

  function samePayoutMonth(d) {
    if (!d) return false;
    return d.getFullYear() === yr && d.getMonth() + 1 === mo;
  }

  const y1Date = new Date(firstPayout);
  const y2Date = subtractOneMonth(addYears(firstPayout, 1));
  const y3Date = addYears(firstPayout, 2);

  const items = [];

  if (insuranceYearsCovered < 1 && samePayoutMonth(y1Date)) items.push({ type: 'Y1 Insurance', amount: 1500, firstPayout });
  if (insuranceYearsCovered < 2 && samePayoutMonth(y2Date)) items.push({ type: 'Y2 Insurance', amount: 1500, firstPayout });
  if (insuranceYearsCovered < 3 && samePayoutMonth(y3Date)) items.push({ type: 'Y3 Insurance', amount: 1500, firstPayout });

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
// GROUP ANALYSIS — shared groups + mismatch flags
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
// RENDER HELPERS
// ─────────────────────────────────────────────────────────────────
function renderNote(note) {
  if (!note) return '<span style="color:var(--text-hint)">—</span>';
  const cls = note.includes('⚑') ? 'badge-flag' : note.includes('pending') ? 'badge-warn' : 'badge-info';
  return `<span class="badge ${cls}">${esc(note)}</span>`;
}

function renderStats(items) {
  document.getElementById('statsGrid').innerHTML = items.map(s =>
    `<div class="stat-box"><span class="stat-val">${s.val}</span><span class="stat-lbl">${s.lbl}</span></div>`
  ).join('');
}

function renderFlags(lines) {
  const box = document.getElementById('flagsBox');
  if (lines.length > 0) {
    box.style.display = 'block';
    document.getElementById('flagsMsg').innerHTML = lines.map(l => `<div>${esc(l)}</div>`).join('');
  } else {
    box.style.display = 'none';
  }
}

function renderMoreRows(total) {
  const el = document.getElementById('moreRows');
  if (total > PREVIEW_COUNT) {
    el.style.display = 'block';
    el.textContent   = `+ ${total - PREVIEW_COUNT} more rows · all included in export`;
  } else {
    el.style.display = 'none';
  }
}

function showResultsSection(title) {
  document.getElementById('resultsSection').style.display = 'block';
  document.getElementById('resultsTitle').textContent = title;
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + val * 86400000);
  }
  if (val instanceof Date) return isNaN(val) ? null : val;
  const s = String(val).trim();
  // PATCH: enforce DD/MM/YYYY — first part is always day when ambiguous
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let day = parseInt(m[1]), mo = parseInt(m[2]);
    let y   = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
    // if first part > 12, it must be day (DD/MM)
    // if second part > 12, it must be day (MM/DD anomaly — swap to be safe)
    // otherwise, always treat as DD/MM (day first)
    if (mo > 12) { [day, mo] = [mo, day]; }  // second part can't be month, swap
    return new Date(y, mo - 1, day);
  }
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// PATCH: strip parenthetical note before parsing (e.g. "4307 (1172.61$)" → reads 4307)
function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  const s = String(val).trim().split('(')[0].trim();
  return parseFloat(s.replace(/[^0-9.\-]/g, '')) || 0;
}

function fmtDate(d) {
  if (!d) return '—';
  return String(d.getDate()).padStart(2,'0') + '/' +
         String(d.getMonth()+1).padStart(2,'0') + '/' +
         String(d.getFullYear()).slice(-2);
}

function fmt(n)  { return Math.round(n).toLocaleString(); }

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className   = 'msg' + (text ? ` show ${type || 'error'}` : '');
}

// ─────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────
fetch('/components/footer.html')
  .then(r => r.text())
  .then(h => { document.getElementById('footer').innerHTML = h; })
  .catch(() => {});

// ─────────────────────────────────────────────────────────────────
// MODE 1 — PAYOUT GENERATOR
// ─────────────────────────────────────────────────────────────────
function runPayout(yr, mo, cycle) {
  const payoutDay  = cycle === '15' ? 15 : new Date(yr, mo, 0).getDate();
  const payoutDate = new Date(yr, mo - 1, payoutDay);
  const hcCutoff   = new Date(2025, 5, 30);

  // Build HC pending map from reference
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

  // Filter by cycle
  const filtered = paymentData.filter(r => {
    const c = String(r.payoutCycle).replace(/\s/g, '');
    const cycleMatch = cycle === '15' ? c === '15' : (c === '30/31' || c === '30' || c === '31');
    const started    = !r.firstPayout || r.firstPayout <= payoutDate;
    return cycleMatch && started;
  });

  // PATCH: pre-pass — which clients have at least one contract end date across all their rows
  const clientHasContractEnd = {};
  filtered.forEach(r => {
    if (!clientHasContractEnd[r.clientName]) clientHasContractEnd[r.clientName] = false;
    if (r.contractEnd) clientHasContractEnd[r.clientName] = true;
  });

  const { sharedGroups, mismatchFlags } = analyzeGroups(filtered);
  const mismatchContainers = new Set(mismatchFlags.map(f => f.container));

  const WEIGHTED_SPLITS = {
    'CONMO0379':   { 'Mohamed Rafi Hakeem': 0.75, 'Sundarrajan Dharmarajan Dhayalakumaran': 0.25 },
    'CONRA181':    { 'Rashedur Rahman Chowdhury': 0.50, 'Reshad Abd Alim': 0.25, 'Adnan Amin Ziaul Amin': 0.25 },
    'CONMRTMN0529':{ 'Muhammad Rameez Tahir Muhammad Naeem': 0.3333, 'Muhammad Jawad Tahir': 0.3333, 'Muhammad Junaid Jamshaid Hafiz Jamshaid Akhtar': 0.3333 },
    'CONNU0415':   { 'Nuzhat Mursaleen Faisal Fakir Mohammed': 0.61, 'Barayil Porakandy Roshan Valiyakath Aboobacker': 0.39 },
  };

  const groups = {};
  filtered.forEach(r => {
    const ibanValid = r.iban && /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(r.iban.replace(/\s/g, ''));
    const key       = (ibanValid ? r.iban.replace(/\s/g, '') : r.accountNo) || r.clientName;
    if (!groups[key]) {
      groups[key] = {
        index: r.index, clientName: r.clientName, iban: r.iban,
        accountNo: r.accountNo, swift: r.swift, bankName: r.bankName,
        clientType: r.clientType, containers: [], totalReturn: 0,
        totalDeduction: 0, deductionItems: [], structuralNotes: [],
        balanceNotes: new Set(), agents: new Set(),
      };
    }

    const g = groups[key];
    g.containers.push(r.container);
    if (r.agent) g.agents.add(r.agent);
    g.totalReturn += r.returnAmt;

    // ── Data quality notes ──
    if (r.contractClosedFlag) g.structuralNotes.push(r.contractClosedFlag);
    if (r.groupId === '__MANUAL_CHECK__') g.structuralNotes.push('⚑ No container or contract number — manual check required');
    if (r.noIban) g.structuralNotes.push('⚑ No IBAN and no account number — verify');

    // PATCH: client type blank (was clientTypeFilledDown)
    if (r.clientTypeBlank) g.structuralNotes.push('⚑ Blank client type');

    // PATCH: contract end date — check all rows for client, skip commission
    const isCommission = r.container && r.container.toLowerCase() === 'commission';
    if (!isCommission) {
      if (!clientHasContractEnd[r.clientName]) {
        g.structuralNotes.push('⚑ No contract end date');
      } else if (r.contractEnd && r.contractEnd < new Date()) {
        g.structuralNotes.push('⚑ Contract end date has passed — verify');
      }
    }

    // PATCH: Abbas Zaigham / Zaigham Abbas — flag for contract review
    if (r.clientName === 'Abbas Zaigham' || r.clientName === 'Zaigham Abbas') {
      g.structuralNotes.push('⚑ For contract review — verify if same person as Abbas Zaigham / Zaigham Abbas');
    }

    // Balance note
    if (r.balanceNote) {
      const fp = r.firstPayout;
      const isThisCycle = fp && fp.getFullYear() === yr && fp.getMonth() + 1 === mo
        && (cycle === '15' ? fp.getDate() === 15 : fp.getDate() === payoutDay);
      if (isThisCycle) g.balanceNotes.add(r.balanceNote);
    }

    const isHcEligible = r.payReceived && r.payReceived <= hcCutoff;
    const cleanIban    = r.iban ? r.iban.replace(/\s/g, '') : '';
    const hcPending    = hcPendingMap[cleanIban] || false;

    if (r.container && mismatchContainers.has(r.container)) {
      const mf = mismatchFlags.find(f => f.container === r.container);
      g.structuralNotes.push(`⚑ Duplicate container mismatch — container ${r.container} appears under different contracts (${mf.contractNos.join(' / ')}) — manual check`);
      const ded = calcDeduction(payoutDate, r.firstPayout, r.insuranceYearsCovered, isHcEligible, hcPending, yr, mo);
      g.totalDeduction += ded.amount;
      g.deductionItems.push(...ded.items);
    } else if (r.groupId !== '__MANUAL_CHECK__' && sharedGroups[r.groupId]) {
      const sg = sharedGroups[r.groupId];
      if (!sg.deductionCalculated) {
        const ded = calcDeduction(payoutDate, r.firstPayout, r.insuranceYearsCovered, isHcEligible, hcPending, yr, mo);
        sg.deductionAmount = ded.amount; sg.deductionItems = ded.items; sg.deductionCalculated = true;
      }
      const contractKey = r.contractNo || [...sg.contractNos].find(c => c !== '__NONE__') || '';
      const weightMap   = WEIGHTED_SPLITS[contractKey];
      const clientShare = weightMap ? (weightMap[r.clientName] ?? (1 / sg.clients.size)) : (1 / sg.clients.size);
      const splitLabel  = weightMap ? Object.values(weightMap).map(v => Math.round(v * 100)).join('-') : `${sg.clients.size} ways`;
      const splitItems  = sg.deductionItems.map(it => ({ ...it, amount: it.amount * clientShare }));
      g.totalDeduction += sg.deductionAmount * clientShare;
      g.deductionItems.push(...splitItems);
      if (sg.deductionAmount > 0) g.structuralNotes.push(`⚑ Shared group ${r.groupId} — deduction split ${splitLabel}`);
    } else {
      const ded = calcDeduction(payoutDate, r.firstPayout, r.insuranceYearsCovered, isHcEligible, hcPending, yr, mo);
      g.totalDeduction += ded.amount;
      g.deductionItems.push(...ded.items);
    }
  });

  results = Object.values(groups).map(g => {
    const roundedDeduction = Math.round(g.totalDeduction);
    const y1Items   = g.deductionItems.filter(it => it.type === 'Y1 Insurance');
    const ipItems   = g.deductionItems.filter(it => it.type === 'Y2 Insurance' || it.type === 'Y3 Insurance');
    const hcApplied = g.deductionItems.filter(it => it.type === 'HC');
    const hcPending = g.deductionItems.filter(it => it.type === 'HC Pending');
    const y1WithOthers = y1Items.length > 0 && ipItems.length > 0;
    const visibleItems = [...y1Items, ...ipItems, ...hcApplied];
    const activeDates  = [...new Set(visibleItems.map(it => fmtDate(it.firstPayout)))];
    const firstPayoutDisplay = activeDates.join(' & ') || '';
    const deductionNotes = [];

    if (ipItems.length > 0) {
      const hasY1 = y1WithOthers, hasY2 = ipItems.some(it => it.type === 'Y2 Insurance'), hasY3 = ipItems.some(it => it.type === 'Y3 Insurance');
      const typeStr  = [hasY1 ? 'Y1' : null, hasY2 ? 'Y2' : null, hasY3 ? 'Y3' : null].filter(Boolean).join(' & ');
      const allItems = [...(y1WithOthers ? y1Items : []), ...ipItems];
      const totalAmt = Math.round(allItems.reduce((s, it) => s + it.amount, 0));
      const dates    = [...new Set(allItems.map(it => fmtDate(it.firstPayout)))];
      let ipNote = `${typeStr} IP ${totalAmt.toLocaleString()} from ${dates.join(' & ')}`;
      if (hcPending.length > 0) ipNote += ' — HC pending next cycle';
      deductionNotes.push(ipNote);
    } else if (hcPending.length > 0) {
      deductionNotes.push('HC pending next cycle');
    }
    if (hcApplied.length > 0) deductionNotes.push('HC 1,000 applied');

    const agentArr = [...g.agents];
    if (agentArr.length > 1) g.structuralNotes.push(`⚑ Multiple agents: ${agentArr.join(' / ')}`);
    const agent = agentArr.length >= 1 ? agentArr[agentArr.length - 1] : '';

    const balanceNoteArr = [...g.balanceNotes];
    const allNotes = [...new Set(g.structuralNotes), ...deductionNotes, ...balanceNoteArr].join(' | ');
    const balanceNumeric = balanceNoteArr.length > 0
      ? (() => { const m = balanceNoteArr.join(' ').match(/[\d]+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; })() : null;
    const hasBalance = balanceNumeric !== null;

    return {
      ...g, agent, totalDeduction: roundedDeduction,
      rentalDue: hasBalance ? null : (g.totalReturn - roundedDeduction),
      balanceAddition: balanceNumeric, firstPayoutDisplay, note: allNotes,
    };
  });

  results.sort((a, b) => a.index - b.index);

  const cycleLabel = cycle === '15' ? '15th' : 'End of Month';
  showResultsSection(`${MONTHS[mo-1]} ${yr} — ${cycleLabel} · ${results.length} payees`);

  const totalReturn = results.reduce((s,r) => s + r.totalReturn, 0);
  const totalDeduct = results.reduce((s,r) => s + r.totalDeduction, 0);
  const totalDue    = results.reduce((s,r) => s + (r.rentalDue || 0), 0);
  renderStats([
    { val: results.length,            lbl: 'Payees' },
    { val: `AED ${fmt(totalReturn)}`, lbl: 'Total Rental' },
    { val: `AED ${fmt(totalDeduct)}`, lbl: 'Total Deductions' },
    { val: `AED ${fmt(totalDue)}`,    lbl: 'Total Due' },
    { val: results.filter(r => r.totalDeduction > 0).length, lbl: 'With Deductions' },
    { val: results.filter(r => r.note).length,               lbl: 'With Notes' },
  ]);

  const flagLines = [];
  const sharedCount = Object.keys(sharedGroups).length;
  if (sharedCount > 0) {
    const names = Object.entries(sharedGroups).map(([gid, meta]) => `${gid} (${[...meta.clients].join(' / ')})`).join('; ');
    flagLines.push(`⚑ ${sharedCount} shared group(s) — deduction split: ${names}`);
  }
  mismatchFlags.forEach(f => {
    flagLines.push(`🔴 Duplicate container mismatch: ${f.container} — contracts ${f.contractNos.join(' / ')} — clients: ${f.clientNames.join(' / ')} — manual check required`);
  });
  renderFlags(flagLines);

  document.getElementById('tableHead').innerHTML = `<tr>
    <th>#</th><th>Name of Clients</th>
    <th style="text-align:center">Units</th>
    <th style="text-align:center">First Payout Date</th>
    <th style="text-align:right">Monthly Rental</th>
    <th style="text-align:right">Deduction</th>
    <th style="text-align:right">Rental Due</th>
    <th>Notes</th>
  </tr>`;

  document.getElementById('tableBody').innerHTML = results.slice(0, PREVIEW_COUNT).map((r, i) => `
    <tr>
      <td class="td-hint">${i+1}</td>
      <td class="td-name">${esc(r.clientName)}</td>
      <td class="td-center td-mono">${r.containers.length}</td>
      <td class="td-mono">${r.firstPayoutDisplay || '—'}</td>
      <td class="td-num">${fmt(r.totalReturn)}</td>
      <td class="td-deduct">${r.totalDeduction > 0 ? fmt(r.totalDeduction) : '—'}</td>
      <td class="td-due">${r.rentalDue !== null ? fmt(r.rentalDue) : '—'}</td>
      <td class="td-note">${renderNote(r.note)}</td>
    </tr>`).join('');

  renderMoreRows(results.length);
}

function exportPayout() {
  const yr    = parseInt(document.getElementById('selYear').value);
  const mo    = parseInt(document.getElementById('selMonth').value);
  const cycle = document.getElementById('selCycle').value;

  const headers = ['CLIENT TYPE','NAME OF CLIENTS','UNITS','FIRST PAYOUT DATE',
    'MONTHLY RENTAL AMOUNT','DEDUCTION','ADDITION','RENTAL DUE',
    'ACCOUNT NUMBER','IBAN NUMBER','SWIFT CODE','BANK NAME','Agent Name','NOTES'];

  const rows = results.map(r => [
    r.clientType || '', r.clientName, r.containers.length,
    r.firstPayoutDisplay || '', r.totalReturn,
    r.totalDeduction || null, r.balanceAddition || null,
    r.rentalDue !== null ? r.rentalDue : null,
    r.accountNo, r.iban, r.swift, r.bankName, r.agent || '', r.note || '',
  ]);

  const totReturn = results.reduce((s,r) => s + r.totalReturn, 0);
  const totDeduct = results.reduce((s,r) => s + r.totalDeduction, 0);
  const totDue    = results.reduce((s,r) => s + (r.rentalDue || 0), 0);
  rows.push(['','TOTAL','','',totReturn,totDeduct,'',totDue,'','','','','','']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{wch:14},{wch:45},{wch:8},{wch:14},{wch:14},{wch:12},{wch:12},{wch:14},{wch:22},{wch:30},{wch:18},{wch:28},{wch:20},{wch:50}];
  XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[mo-1]} ${yr} - ${cycle === '15' ? '15th' : 'EOM'}`.substring(0, 31));
  XLSX.writeFile(wb, getExpectedOutputFilename());
}

// ─────────────────────────────────────────────────────────────────
// MODE 2 — IP DEDUCTION
// ─────────────────────────────────────────────────────────────────
function runIPDeduction(yr, mo, cycle) {
  const payoutDay  = cycle === '15' ? 15 : new Date(yr, mo, 0).getDate();
  const payoutDate = new Date(yr, mo - 1, payoutDay);
  const hcCutoff   = new Date(2025, 5, 30);

  const filtered = paymentData.filter(r => {
    const c = String(r.payoutCycle).replace(/\s/g, '');
    const cycleMatch = cycle === '15' ? c === '15' : (c === '30/31' || c === '30' || c === '31');
    const started    = !r.firstPayout || r.firstPayout <= payoutDate;
    return cycleMatch && started;
  });

  const { sharedGroups, mismatchFlags } = analyzeGroups(filtered);
  const mismatchContainers = new Set(mismatchFlags.map(f => f.container));

  const groups = {};
  filtered.forEach(r => {
    const ibanValid = r.iban && /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(r.iban.replace(/\s/g, ''));
    const key       = (ibanValid ? r.iban.replace(/\s/g, '') : r.accountNo) || r.clientName;
    if (!groups[key]) {
      groups[key] = {
        index: r.index, clientName: r.clientName, iban: r.iban,
        accountNo: r.accountNo, containers: [], totalDeduction: 0,
        deductionItems: [], notes: [],
      };
    }
    const g = groups[key];
    g.containers.push(r.container);

    const isHcEligible = r.payReceived && r.payReceived <= hcCutoff;
    const cleanIban    = r.iban ? r.iban.replace(/\s/g, '') : '';

    let clientShare = 1;
    if (r.container && mismatchContainers.has(r.container)) {
      const mf = mismatchFlags.find(f => f.container === r.container);
      g.notes.push(`⚑ Duplicate container mismatch: ${r.container} — contracts ${mf.contractNos.join(' / ')}`);
    } else if (r.groupId !== '__MANUAL_CHECK__' && sharedGroups[r.groupId]) {
      const sg = sharedGroups[r.groupId];
      clientShare = 1 / sg.clients.size;
      if (!sg.deductionCalculated) {
        const ded = calcDeduction(payoutDate, r.firstPayout, r.insuranceYearsCovered, isHcEligible, false, yr, mo);
        sg.deductionAmount = ded.amount; sg.deductionItems = ded.items; sg.deductionCalculated = true;
      }
      const splitItems = sg.deductionItems.map(it => ({ ...it, amount: it.amount * clientShare }));
      g.totalDeduction += sg.deductionAmount * clientShare;
      g.deductionItems.push(...splitItems);
      if (sg.deductionAmount > 0) g.notes.push(`Shared container — deduction split ${sg.clients.size} ways`);
      return;
    }

    const ded = calcDeduction(payoutDate, r.firstPayout, r.insuranceYearsCovered, isHcEligible, false, yr, mo);
    g.totalDeduction += ded.amount * clientShare;
    g.deductionItems.push(...ded.items.map(it => ({ ...it, amount: it.amount * clientShare })));
  });

  results = Object.values(groups)
    .filter(g => g.totalDeduction > 0)
    .sort((a, b) => a.index - b.index)
    .map(g => {
      const dedNotes = [];
      const byType = {};
      g.deductionItems.forEach(it => {
        if (!byType[it.type]) byType[it.type] = 0;
        byType[it.type] += it.amount;
      });
      ['Y1 Insurance','Y2 Insurance','Y3 Insurance','HC'].forEach(t => {
        if (byType[t]) dedNotes.push(`${t.replace(' Insurance',' IP')} — AED ${fmt(byType[t])}`);
      });
      const allNotes = [...new Set(g.notes), ...dedNotes].join(' | ');
      return { ...g, totalDeduction: Math.round(g.totalDeduction), note: allNotes };
    });

  const cycleLabel = cycle === '15' ? '15th' : 'End of Month';
  showResultsSection(`${MONTHS[mo-1]} ${yr} — ${cycleLabel} · ${results.length} clients with deductions`);

  const totalDeduct = results.reduce((s,r) => s + r.totalDeduction, 0);
  renderStats([
    { val: results.length,            lbl: 'Clients' },
    { val: `AED ${fmt(totalDeduct)}`, lbl: 'Total Deductions' },
    { val: results.filter(r => r.deductionItems.some(i => i.type.includes('Y1'))).length, lbl: 'Y1 IP' },
    { val: results.filter(r => r.deductionItems.some(i => i.type.includes('Y2'))).length, lbl: 'Y2 IP' },
    { val: results.filter(r => r.deductionItems.some(i => i.type.includes('Y3'))).length, lbl: 'Y3 IP' },
    { val: results.filter(r => r.deductionItems.some(i => i.type === 'HC')).length,       lbl: 'HC' },
  ]);

  renderFlags([]);

  document.getElementById('tableHead').innerHTML = `<tr>
    <th>#</th><th>Name of Clients</th>
    <th style="text-align:center">Units</th>
    <th style="text-align:center">First Payout Date</th>
    <th style="text-align:right">Deduction</th>
    <th>Deduction Breakdown</th>
  </tr>`;

  document.getElementById('tableBody').innerHTML = results.slice(0, PREVIEW_COUNT).map((r, i) => {
    const fp = r.deductionItems[0] ? fmtDate(r.deductionItems[0].firstPayout) : '—';
    return `<tr>
      <td class="td-hint">${i+1}</td>
      <td class="td-name">${esc(r.clientName)}</td>
      <td class="td-center td-mono">${r.containers.length}</td>
      <td class="td-mono">${fp}</td>
      <td class="td-deduct">${fmt(r.totalDeduction)}</td>
      <td class="td-note">${renderNote(r.note)}</td>
    </tr>`;
  }).join('');

  renderMoreRows(results.length);
}

function exportIPDeduction() {
  const yr  = parseInt(document.getElementById('selYear').value);
  const mo  = parseInt(document.getElementById('selMonth').value);

  const headers = ['CLIENT NAME','IBAN','ACCOUNT NUMBER','UNITS','DEDUCTION (AED)','NOTES'];
  const rows = results.map(r => [
    r.clientName, r.iban || '', r.accountNo || '',
    r.containers.length, r.totalDeduction, r.note || '',
  ]);

  const totDeduct = results.reduce((s,r) => s + r.totalDeduction, 0);
  rows.push(['TOTAL','','','',totDeduct,'']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{wch:45},{wch:30},{wch:22},{wch:8},{wch:16},{wch:60}];
  XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[mo-1]} ${yr} IP Deduction`.substring(0, 31));
  XLSX.writeFile(wb, getExpectedOutputFilename());
}

// ─────────────────────────────────────────────────────────────────
// MODE 3 — CONTAINER INFO
// ─────────────────────────────────────────────────────────────────
function calcAge(from, to) {
  if (!from || !to) return '—';
  let y = to.getFullYear() - from.getFullYear();
  let m = to.getMonth()    - from.getMonth();
  let d = to.getDate()     - from.getDate();
  if (d < 0) { m--; d += new Date(to.getFullYear(), to.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  const parts = [];
  if (y) parts.push(y + 'y');
  if (m) parts.push(m + 'm');
  if (d) parts.push(d + 'd');
  return parts.join(' ') || '0d';
}

function calcTrips(firstPayout, payoutDate) {
  if (!firstPayout) return 0;
  let m = (payoutDate.getFullYear() - firstPayout.getFullYear()) * 12
        + (payoutDate.getMonth()    - firstPayout.getMonth());
  if (payoutDate.getDate() >= firstPayout.getDate()) m++;
  return Math.max(0, m);
}

function runContainerInfo(yr, mo, cycle) {
  const payoutDay  = cycle === '15' ? 15 : new Date(yr, mo, 0).getDate();
  const payoutDate = new Date(yr, mo - 1, payoutDay);
  payoutDate.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);

  const filtered = paymentData.filter(r => {
    const c = String(r.payoutCycle).replace(/\s/g, '');
    const cycleMatch = cycle === '15' ? c === '15' : (c === '30/31' || c === '30' || c === '31');
    if (!cycleMatch) return false;
    if (!r.firstPayout) return false;
    if (r.container && r.container.toLowerCase() === 'commission') return false;
    return r.firstPayout <= payoutDate;
  });

  const { sharedGroups, mismatchFlags } = analyzeGroups(filtered);
  const mismatchContainers = new Set(mismatchFlags.map(f => f.container));

  results = filtered.map(r => {
    const age         = calcAge(r.payReceived, payoutDate);
    const fpDay       = r.firstPayout ? r.firstPayout.getDate() : null;
    const fpIs15      = fpDay === 15;
    const cycleIs15   = parseInt(r.payoutCycle, 10) === 15;
    const cycleMismatch = fpDay !== null && cycleIs15 !== fpIs15;

    const hasTotalTrips = r.totalTrips !== null;
    const tripsDone  = (!r.isFlexible && hasTotalTrips) ? calcTrips(r.firstPayout, payoutDate) : null;
    const tripsTotal = (!r.isFlexible && hasTotalTrips) ? r.totalTrips : null;
    const tripsRem   = (tripsDone !== null && tripsTotal !== null) ? Math.max(0, tripsTotal - tripsDone) : null;
    const compPmt    = (!r.isFlexible && tripsDone !== null) ? r.returnAmt * tripsDone : null;
    const pendPmt    = (!r.isFlexible && tripsRem  !== null) ? r.returnAmt * tripsRem  : null;

    const notes = [];
    if (r.contractClosedFlag)  notes.push(r.contractClosedFlag);
    if (cycleMismatch)         notes.push('⚑ Cycle mismatch — check first payout date');

    // PATCH: container type blank (removed "filled down" message)
    if (r.containerTypeBlank)  notes.push('⚑ No container type — verify database');
    // PATCH: client type blank (removed "filled down" message)
    if (r.clientTypeBlank)     notes.push('⚑ Blank client type');

    if (r.noIban)              notes.push('⚑ No IBAN and no account number — verify');

    // PATCH: commission clients skip the contract end date check
    const isCommission = r.container && r.container.toLowerCase() === 'commission';
    if (!isCommission) {
      if (!r.contractEnd)              notes.push('⚑ No contract end date');
      else if (r.contractEnd < today)  notes.push('⚑ Contract end date has passed — verify');
    }

    if (r.groupId === '__MANUAL_CHECK__') notes.push('⚑ No container or contract number — manual check');
    if (r.container && mismatchContainers.has(r.container)) {
      const mf = mismatchFlags.find(f => f.container === r.container);
      notes.push(`⚑ Duplicate container — contracts: ${mf.contractNos.join(' / ')}`);
    } else if (r.groupId !== '__MANUAL_CHECK__' && sharedGroups[r.groupId]) {
      notes.push(`⚑ Shared group: ${r.groupId}`);
    }
    if (!r.isFlexible && !hasTotalTrips) notes.push('⚑ Trips not in sheet');
    if (r.isFlexible) notes.push('⚑ Flexible leasing — no trips or payments computed');
    if (r.balanceNote) notes.push(`Balance pending: ${r.balanceNote}`);

    return { ...r, age, tripsDone, tripsTotal, tripsRem, compPmt, pendPmt, note: notes.join(' | ') };
  });

  const cycleLabel  = cycle === '15' ? '15th' : 'End of Month';
  const uniqueClients = new Set(results.map(r => r.clientName)).size;
  showResultsSection(`${MONTHS[mo-1]} ${yr} — ${cycleLabel} · ${results.length} containers · ${uniqueClients} clients`);

  const fixed   = results.filter(r => !r.isFlexible);
  const flex    = results.filter(r =>  r.isFlexible);
  const pending = fixed.reduce((s,r) => s + (r.pendPmt || 0), 0);

  renderStats([
    { val: uniqueClients,         lbl: 'Clients' },
    { val: results.length,        lbl: 'Containers' },
    { val: fixed.length,          lbl: 'Fixed' },
    { val: flex.length,           lbl: 'Flexible' },
    { val: `AED ${fmt(pending)}`, lbl: 'Total Pending' },
  ]);

  const flagLines = [];
  mismatchFlags.forEach(f => {
    flagLines.push(`🔴 Duplicate container mismatch: ${f.container} — contracts ${f.contractNos.join(' / ')} — manual check`);
  });
  renderFlags(flagLines);

  document.getElementById('tableHead').innerHTML = `<tr>
    <th>#</th><th>Name</th>
    <th style="text-align:center">Monthly Rental</th>
    <th style="text-align:center">P.I.N.</th>
    <th style="text-align:center">Type</th>
    <th style="text-align:center">Age</th>
    <th style="text-align:center">Trips Left</th>
    <th style="text-align:right">Payout Complete</th>
    <th style="text-align:right">Payout Pending</th>
    <th style="text-align:center">Contract End</th>
    <th>Notes</th>
  </tr>`;

  document.getElementById('tableBody').innerHTML = results.slice(0, PREVIEW_COUNT).map((r, i) => `
    <tr>
      <td class="td-hint">${i+1}</td>
      <td class="td-name">${esc(r.clientName)}</td>
      <td class="td-center td-mono">${r.isFlexible
        ? (parseFloat(r.returnRaw) < 1 ? (parseFloat(r.returnRaw) * 100) + '%' : r.returnRaw)
        : (r.returnAmt > 0 ? fmt(r.returnAmt) : '—')}</td>
      <td class="td-mono">${esc(r.container) || '—'}</td>
      <td class="td-mono">${esc(r.containerType) || '—'}</td>
      <td class="td-mono">${r.age.replace(/\s*\d+d$/, '').trim() || r.age}</td>
      <td class="td-num">${r.tripsRem  !== null ? r.tripsRem  : '—'}</td>
      <td class="td-num">${r.compPmt !== null ? fmt(r.compPmt) : '—'}</td>
      <td class="td-num">${r.pendPmt !== null ? fmt(r.pendPmt) : '—'}</td>
      <td class="td-mono">${fmtDate(r.contractEnd)}</td>
      <td class="td-note">${renderNote(r.note)}</td>
    </tr>`).join('');

  renderMoreRows(results.length);
}

function exportContainerInfo() {
  const yr    = parseInt(document.getElementById('selYear').value);
  const mo    = parseInt(document.getElementById('selMonth').value);
  const cycle = document.getElementById('selCycle').value;

  const hdr = ['TYPE','NAME','PAYMENT DATE','LEASE DATE','FIRST PAYOUT',
    'MONTHLY RENTAL','P.I.N.','TYPE','AGE','TOTAL TRIPS','TRIPS DONE',
    'TRIPS LEFT','MODEL','PAYOUT COMPLETE(AED)','PAYOUT PENDING(AED)','CONTRACT END DATE','NOTES'];

  const data = results.map(r => [
    r.clientType || '', r.clientName,
    r.payReceived  ? fmtDate(r.payReceived)  : '',
    r.payCalcStart ? fmtDate(r.payCalcStart) : '',
    r.firstPayout  ? fmtDate(r.firstPayout)  : '',
    r.isFlexible ? (parseFloat(r.returnRaw) < 1 ? (parseFloat(r.returnRaw) * 100) + '%' : r.returnRaw) : (r.returnAmt || ''),
    r.container || '', r.containerType || '', r.age,
    r.tripsTotal !== null ? r.tripsTotal : '',
    r.tripsDone  !== null ? r.tripsDone  : '',
    r.tripsRem   !== null ? r.tripsRem   : '',
    r.isFlexible ? 'Flexible' : 'Fixed',
    r.compPmt !== null ? r.compPmt : '',
    r.pendPmt !== null ? r.pendPmt : '',
    r.contractEnd ? fmtDate(r.contractEnd) : '',
    r.note || '',
  ]);

  const totRental  = results.reduce((s,r) => s + r.returnAmt, 0);
  const totPending = results.reduce((s,r) => s + (r.pendPmt || 0), 0);
  data.push(['','TOTAL','','','',totRental,'','','','','','','','',totPending,'','']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([hdr, ...data]);
  ws['!cols'] = [{wch:14},{wch:40},{wch:14},{wch:14},{wch:14},{wch:16},{wch:18},{wch:16},{wch:12},{wch:10},{wch:10},{wch:12},{wch:12},{wch:18},{wch:18},{wch:14},{wch:55}];
  XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[mo-1]} ${yr} - ${cycle === '15' ? '15th' : 'EOM'}`.substring(0, 31));
  XLSX.writeFile(wb, getExpectedOutputFilename());
}

// ─────────────────────────────────────────────────────────────────
// MODE 4 — EMAIL MATCHER
// ─────────────────────────────────────────────────────────────────
const NAME_PREFIXES = /^(mr\.?|mrs\.?|ms\.?)\s+/i;

function normalizeName(value, stripPrefixes) {
  let name = String(value || '').trim();
  if (stripPrefixes) name = name.replace(NAME_PREFIXES, '');
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseDateValue(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return '';
    return `${String(parsed.d).padStart(2,'0')}/${String(parsed.m).padStart(2,'0')}/${parsed.y}`;
  }
  const raw = String(value).trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/);
  if (match) {
    let a = parseInt(match[1],10), b = parseInt(match[2],10), c = parseInt(match[3],10);
    let day, month, year;
    if (match[1].length === 4) { year=a; month=b; day=c; } else { day=a; month=b; year=c; }
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;
  }
  return '';
}

function splitEmails(value) {
  const text = String(value || '').trim();
  if (!text) return ['',''];
  const parts = text.split(/[,:;\s]+/).map(p => p.trim()).filter(Boolean);
  return [parts[0] || '', parts[1] || ''];
}

function buildEmailRecords() {
  const rows = emailData.slice(1);
  let lastEmail = '', lastMobile = '';
  rows.forEach(row => {
    const e = row[15] != null ? String(row[15]).trim() : '';
    const m = row[16] != null ? String(row[16]).trim() : '';
    if (e) lastEmail  = e; else if (lastEmail)  row[15] = lastEmail;
    if (m) lastMobile = m; else if (lastMobile) row[16] = lastMobile;
  });

  const grouped = new Map();
  rows.forEach(row => {
    const rawName    = String(row[0] || '').trim();
    const parenMatch = rawName.match(/\(([^)]+)\)/);
    const mainName   = rawName.replace(/\([^)]*\)/g, ' ').trim();
    const normName   = normalizeName(mainName || rawName, true);
    const normParen  = parenMatch ? normalizeName(parenMatch[1], true) : '';
    const emailRaw   = String(row[15] || '').trim();
    const emails     = emailRaw.split(/[,:;\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean);

    const record = {
      emailSheetClientName: rawName, normName, normParen,
      agentEmail: String(row[2] || '').split(/[,:;\s]+/)[0].trim(),
      paymentReceivedDate: parseDateValue(row[5]),
      clientEmailRaw: emailRaw,
      mobile: String(row[16] || '').split(/[,;]+/)[0].replace(/\s+/g,'').trim(),
      multipleEmails: emails.length > 1,
    };

    if (!grouped.has(normName)) grouped.set(normName, record);
  });

  return Array.from(grouped.values());
}

const AGENT_EMAIL_MAP = {
  'faiqa':             'bdm@legendmaritime.com',
  'naushad':           'manager@coraluae.com',
  'numan':             'wm@aim-bc.com',
  'kate':              'wm@aim-bc.com',
  'ali altawel':       'ali_altawel@legendmaritime.com',
  'mustafa':           'ali_altawel@legendmaritime.com',
  'janagan':           'janagan@legendmaritime.com',
  'christian':         'christian@legendmaritime.com',
  'himali':            'renz@legendmaritime.com',
  'ms. sagithra nath': 'cfo@legendmaritime.com',
  'sagithra nath':     'cfo@legendmaritime.com',
  'mag':               'lauriane@legendmaritime.com',
  'mr. ahnaf':         'mohamedahnaf@legendmaritime.com',
  'ahnaf':             'mohamedahnaf@legendmaritime.com',
  'ruheed':            'ruheed@coraluae.com',
  'athul':             'athul@coraluae.com',
  'sanjana':           'sanjana@legendmaritime.com',
  'khadija':           'khadija@coraluae.com',
  'renz':              'renz@legendmaritime.com',
};

function runEmailMatcher(yr, mo, cycle) {
  if (!emailData.length) { showMsg('genError', 'Please upload the email sheet.', 'error'); return; }

  const emailRecords = buildEmailRecords();

  const prevMatchMap = new Map();
  if (refData.length > 1) {
    refData.slice(1).forEach(r => {
      if (!r || !r[0]) return;
      const normName = normalizeName(String(r[0]), true);
      prevMatchMap.set(normName, {
        email1: String(r[3] || '').trim(), email2: String(r[4] || '').trim(),
        mobile: String(r[5] || '').trim(),
      });
    });
  }

  const payoutDay  = cycle === '15' ? 15 : new Date(yr, mo, 0).getDate();
  const payoutDate = new Date(yr, mo - 1, payoutDay);

  const filtered = paymentData.filter(r => {
    const c = String(r.payoutCycle).replace(/\s/g, '');
    const cycleMatch = cycle === '15' ? c === '15' : (c === '30/31' || c === '30' || c === '31');
    return cycleMatch && (!r.firstPayout || r.firstPayout <= payoutDate);
  });

  const clientGroups = new Map();
  filtered.forEach(r => {
    const norm = normalizeName(r.clientName, false);
    if (!clientGroups.has(norm)) {
      clientGroups.set(norm, { clientName: r.clientName, norm, units: 0, agent: r.agent, note: '' });
    }
    const g = clientGroups.get(norm);
    g.units += 1;
    if (r.agent) g.agent = r.agent;
  });

  results = Array.from(clientGroups.values()).map(group => {
    const normName   = group.norm;
    const parenMatch = group.clientName.match(/\(([^)]+)\)/);
    const normParen  = parenMatch ? normalizeName(parenMatch[1], false) : '';
    const normOuter  = normalizeName(group.clientName.replace(/\([^)]*\)/g, ' ').trim(), false);

    const lookup  = n => emailRecords.find(r => r.normName === n || r.normParen === n);
    const matched = (normParen && lookup(normParen)) || lookup(normOuter) || null;

    const [email1raw, email2raw] = splitEmails(matched ? matched.clientEmailRaw : '');
    let email1 = email1raw, email2 = email2raw, mobile = matched ? matched.mobile : '';

    const prev = prevMatchMap.get(normName);
    if (prev) {
      if (!email1 && prev.email1) { email1 = prev.email1; email2 = prev.email2; }
      if (!mobile && prev.mobile) mobile = prev.mobile;
    }

    const resolvedAgentEmail = AGENT_EMAIL_MAP[group.agent.toLowerCase().trim()]
      || (matched ? matched.agentEmail : '') || '';

    const notes = [];
    const hasMultiAgents = group.note && /multiple agents/i.test(group.note);
    if (hasMultiAgents) {
      notes.push(group.note);
    } else {
      if (!matched)                                          notes.push('Name not found in email sheet');
      if (matched && !email1)                                notes.push('Email missing in email sheet');
      if (matched && matched.multipleEmails)                 notes.push('Multiple emails detected');
      if (matched && !resolvedAgentEmail)                    notes.push('Agent email missing');
      else if (matched && matched.agentEmail && matched.agentEmail !== resolvedAgentEmail) notes.push('Agent email mismatch');
      if (matched && !group.agent)                           notes.push('Agent name missing');
    }

    const status = matched ? 'valid' : 'invalid';

    return {
      clientName: group.clientName, emailSheetClientName: matched ? matched.emailSheetClientName : '',
      units: group.units, email1, email2, mobile,
      agentClosing: group.agent, agentEmail: resolvedAgentEmail,
      notes: notes.join(' | '), status,
    };
  });

  const cycleLabel = cycle === '15' ? '15th' : 'End of Month';
  showResultsSection(`${MONTHS[mo-1]} ${yr} — ${cycleLabel} · ${results.length} clients`);

  const confirmed    = results.filter(r => r.status === 'valid').length;
  const clientErrors = results.filter(r => r.notes && (/name not found|email missing|multiple emails/i.test(r.notes))).length;
  const agentErrors  = results.filter(r => r.notes && (/agent email|agent name|multiple agents/i.test(r.notes))).length;

  renderStats([
    { val: results.length, lbl: 'Total' },
    { val: confirmed,      lbl: 'Confirmed' },
    { val: clientErrors,   lbl: 'Client Errors' },
    { val: agentErrors,    lbl: 'Agent Errors' },
  ]);

  renderFlags([]);

  document.getElementById('tableHead').innerHTML = `<tr>
    <th>#</th>
    <th>Client Name (Payment Sheet)</th>
    <th>Client Name (Email Sheet)</th>
    <th>Email 1</th>
    <th>Agent Closing</th>
    <th>Notes</th>
  </tr>`;

  document.getElementById('tableBody').innerHTML = results.slice(0, PREVIEW_COUNT).map((r, i) => {
    const noteBadge = r.notes
      ? `<span class="badge ${r.status === 'valid' ? 'badge-warn' : 'badge-flag'}">${esc(r.notes)}</span>`
      : `<span class="badge badge-ok">Confirmed</span>`;
    return `<tr>
      <td class="td-hint">${i+1}</td>
      <td class="td-name">${esc(r.clientName)}</td>
      <td style="color:var(--text-muted);font-size:12px">${esc(r.emailSheetClientName || '—')}</td>
      <td class="td-mono">${esc(r.email1 || '—')}</td>
      <td>${esc(r.agentClosing || '—')}</td>
      <td class="td-note">${noteBadge}</td>
    </tr>`;
  }).join('');

  renderMoreRows(results.length);
}

function exportEmailMatcher() {
  const yr = parseInt(document.getElementById('selYear').value);
  const mo = parseInt(document.getElementById('selMonth').value);

  const exportRows = results.map(r => ({
    'Client Name (LMC Sheet)':   r.clientName,
    'Client Name (Email Sheet)': r.emailSheetClientName,
    'Units':         r.units,
    'Email 1':       r.email1,
    'Email 2':       r.email2,
    'Mobile':        r.mobile,
    'Agent Closing': r.agentClosing,
    'Agent Email':   r.agentEmail,
    'Notes':         r.notes,
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[mo-1]} ${yr} Email Matcher`.substring(0, 31));
  XLSX.writeFile(wb, getExpectedOutputFilename());
}
