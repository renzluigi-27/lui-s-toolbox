// ─────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────
let paymentData   = [];   // parsed rows from payment info sheet
let refPayoutData = [];   // parsed rows from previous payout (optional)
let results       = [];   // final processed rows

// ─────────────────────────────────────────────────────────────────
// SHARED CONTAINERS — reference map (used for #2: skip fill-down unless shared)
// ─────────────────────────────────────────────────────────────────
const SHARED_CONTAINERS = {
  'LGMU2023199': ['Mohamed Rafi Hakeem', 'Sundarrajan Dharmarajan Dhayalakumaran'],
  'LGMU2023202': ['Mohamed Rafi Hakeem', 'Sundarrajan Dharmarajan Dhayalakumaran'],
  'LGMU2023218': ['Mohamed Rafi Hakeem', 'Sundarrajan Dharmarajan Dhayalakumaran'],
  'LGMU2023223': ['Mohamed Rafi Hakeem', 'Sundarrajan Dharmarajan Dhayalakumaran'],
  'LGMU2024596': ['Peter Werner Tutschek', 'Simone Landoni'],
  'LGMU2024600': ['Peter Werner Tutschek', 'Simone Landoni'],
  'LGMU2024615': ['Peter Werner Tutschek', 'Simone Landoni'],
  'LGMU2024620': ['Peter Werner Tutschek', 'Simone Landoni'],
  'LGMU2240358': ['Hafiz Muhammad Umair Abbas Chaudhry', 'Muhammad Junaid Jamshaid Hafiz Jamshaid Akhtar'],
  'LGMU2241626': ['Irish Pizana Alsola', 'Ranjith Mohanan Nair'],
  'LGMU2241755': ['Barayil Porakandy Roshan Valiyakath Aboobacker', 'Nuzhat Mursaleen Faisal Fakir Mohammed'],
  'LGMU2241884': ['Nawaid Ahmed Muhammed Aziz', 'Zahid Khan'],
  'LGMU2242812': ['Irish Pizana Alsola', 'Ranjith Mohanan Nair'],
  'LGMU2243676': ['Charlotte Fallows', 'Simone Landoni'],
  'LGMU2243681': ['Charlotte Fallows', 'Simone Landoni'],
  'LGMU2245200': ['Jamshed Husain Haseen Mian', 'Muzaffar Hakim Khan'],
  'LGMU2245220': ['Jamshed Husain Haseen Mian', 'Muzaffar Hakim Khan'],
  'LGMU2246280': ['Kunnal Kishore Makhija Kishore Jethanand Makhija', 'Sunny Jaikishan Dadlani Jaikishan Nenumal Dadlani'],
  'LGMU2251624': ['Ahmed Mohamed Elarabi Mohamed Ibrahim Halima', 'Mohamed Yousri Ebrahim Elsherbiny'],
  'LGMU2251650': ['Abhai Kumar Srivastava Satgur Saran Srivastava', 'Saji Krishnankutty Krishnan Kutty Keshavan'],
  'LGMU2252338': ['Irish Pizana Alsola', 'Ranjith Mohanan Nair'],
  'LGMU2252894': ['Charan Tej Pavan Kumar Vuyyuru', 'Shilpa Kansal Deepak Kansal'],
  'LGMU2253925': ['Charlotte Fallows', 'Simone Landoni'],
  'LGMU2253930': ['Charlotte Fallows', 'Simone Landoni'],
  'LGMU2255110': ['Abbas Waseem Mazher Islam', 'Muhammad Jawad Tahir', 'Muhammad Rameez Tahir Muhammad Naeem'],
  'LGMU2257176': ['Kunnal Kishore Makhija Kishore Jethanand Makhija', 'Sunny Jaikishan Dadlani Jaikishan Nenumal Dadlani'],
  'LGMU2258172': ['Mozard Daraius Antia', 'Zahir Asgher'],
  'LGMU2258280': ['Muhammad Jawad Tahir', 'Muhammad Junaid Jamshaid Hafiz Jamshaid Akhtar', 'Muhammad Rameez Tahir Muhammad Naeem'],
  'LGMU2263440': ['Ahmed Mohamed Elarabi Mohamed Ibrahim Halima', 'Mohamed Yousri Ebrahim Elsherbiny'],
  'LGMU2264940': ['Ghulam Sabir Muhammad Ashraf', 'Syed Rafaqat Rasul Syed Shoukat Rasul'],
  'LGMU2265103': ['Manzoor Hussain Rashid Ahmad', 'Saad Mahmood Khalid Mahmood'],
  'LGMU2265192': ['Hassam Mumtaz Muhammad Mumtaz', 'Murtaza Hussain Zar Wali Khan', 'Usman Afreen Muhammad Afreen'],
  'LGMU2265335': ['Mohamed Sameer Abdul Razak Kazi', 'Zubair Zakir Isane'],
  'LGMU2267153': ['Nimesha Rushan Thajudeen', 'Vishwa Dasantha Mohoppu'],
  'LGMU2267620': ['Manzoor Hussain Rashid Ahmad', 'Saad Mahmood Khalid Mahmood'],
  'LGMU2272777': ['Jamshed Ahmed Khan Jamil', 'Naeem Banu Baksh'],
  'LGMU2274949': ['Ahmed Hassan Mohamed Elhobi', 'Mohamed Elmitwalli Issa Mohamed'],
  'LGMU2275420': ['Dinesh Narwani Bhagwan Das Narwani', 'Kedar Shyamkant Desai Shyamkant Shridhar Desai'],
  'LGMU2276290': ['Muhammad Maaz Khan Abid Khan', 'Zahid Khan (Kamran Naeem)'],
  'LGMU2276915': ['Hafiz Muhammad Umair Abbas Chaudhry', 'Rafi Akram Mohammed'],
  'LGMU2279658': ['Abdul Rahman Mohamed Eliyas', 'Rashed Mohammad Hassan Mohammed Almulla'],
  'LGMU2280860': ['Jamshed Husain Haseen Mian', 'Muzaffar Hakim Khan'],
  'LGMU2281085': ['Abeer Abdulkarem Ali Haider', 'Mohamad Mazen Mostafa Mossli'],
  'LGMU2281090': ['Aamir Ali Ahmed Ali', 'Manzoor Hussain Rashid Ahmad'],
  'LMCU2013799': ['Nishoy Pavithran Kandarassery', 'Roshan Barayil Porakandy'],
  'LMCU2016877': ['Allen Jose Naippallichiryil Chandy Joseph', 'Ranjith Mohanan Nair'],
  'LMCU20203219': ['Deepak Kansal', 'Praveen Kumar Kandakurtikanddakurti Laxmi'],
  'LMCU2022119': ['Roshan Barayil Porakandy/Nosh', 'Sujith Surendran'],
  'LMCU2022424': ['Balakrishnan Mohan Gopal', 'Narasimhan Varada Vishnu Kidambi'],
  'LMCU2023259': ['Hizqeel Ahmad Malik', 'Sajeel Ahmad Malik'],
  'LMCU2023567': ['Kamran Naeem', 'Zahid Khan'],
  'LMCU2023679': ['Balakrishnan Mohan Gopal', 'Narasimhan Varada Vishnu Kidambi'],
  'LMCU2023717': ['Adnan Amin Ziaul Amin', 'Rashedur Rahman Chowdhury Mohd Ramzan', 'Reshad Abd Alim'],
  'LMCU2024099': ['Nawaid Ahmed Muhammed Aziz', 'Zahid Khan'],
  'LMCU2024439': ['Mohamed Abul Faiz Valan Kaja Mohideen Syed Ahamed Syed', 'Mohideen Masthan Thakkadi Mohamed Rafi'],
  'LMCU2024607': ['Peter Werner Tutschek', 'Simone Landoni'],
  'LMCU20246789': ['Jerastine Mozard Antia Dinshah Jamshed Jilla', 'Nishoy Pavithran Kandarassery'],
  'LMCU2024747': ['Abdul Jasim Abdullah Yousuf', 'Abdul Sattar Abdullah Yousef'],
  'LMCU2024887': ['Douglas Robertson Wylie', 'Skerdi Strazimiri'],
  'LMCU2024927': ['Allen Jose Naippallichiryil Chandy Joseph', 'Ranjith Mohanan Nair'],
  'LMCU2024949': ['Nimesha Rushan Thajudeen', 'Vishwa Dasantha Mohoppu'],
  'LMCU2024977': ['Karuna Mansukhani', 'Sapna Mansukhani'],
  'LMCU2069509': ['Mohamed Abul Faiz Valan Kaja Mohideen Syed Ahamed Syed', 'Sunju John Mavely Thomas John'],
  'LMCU20242249': ['Deepika Jeevan Jeppu', 'Imdad Ali Abdul Shaikh'],
};

// ─────────────────────────────────────────────────────────────────
// INIT — populate year selector, default to current month
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
})();

// ─────────────────────────────────────────────────────────────────
// FILE UPLOAD — main sheet
// ─────────────────────────────────────────────────────────────────
const uploadZone = document.getElementById('uploadZone');
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleMainFile(e.dataTransfer.files[0]); });
document.getElementById('fileInput').addEventListener('change', e => { if (e.target.files[0]) handleMainFile(e.target.files[0]); });

function handleMainFile(file) {
  showMsg('fileError', '');
  if (!file.name.match(/\.(xlsx|xls)$/i)) { showMsg('fileError', 'Please upload an Excel file (.xlsx or .xls)', 'error'); return; }
  readExcel(file, rows => {
    paymentData = parsePaymentSheet(rows);
    document.getElementById('fileLoaded').classList.add('show');
    document.getElementById('loadedName').textContent = file.name;
    document.getElementById('loadedMeta').textContent = `${paymentData.length} active contracts loaded`;
    document.getElementById('generateBtn').disabled = false;
    document.getElementById('generateHint').textContent = 'Ready to generate';
  }, err => showMsg('fileError', 'Error reading file: ' + err, 'error'));
}

// ─────────────────────────────────────────────────────────────────
// FILE UPLOAD — reference payout (optional)
// ─────────────────────────────────────────────────────────────────
const refZone = document.getElementById('refUploadZone');
refZone.addEventListener('dragover', e => { e.preventDefault(); refZone.classList.add('dragover'); });
refZone.addEventListener('dragleave', () => refZone.classList.remove('dragover'));
refZone.addEventListener('drop', e => { e.preventDefault(); refZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleRefFile(e.dataTransfer.files[0]); });
document.getElementById('refFileInput').addEventListener('change', e => { if (e.target.files[0]) handleRefFile(e.target.files[0]); });

function handleRefFile(file) {
  showMsg('refError', '');
  if (!file.name.match(/\.(xlsx|xls)$/i)) { showMsg('refError', 'Please upload an Excel file', 'error'); return; }
  readExcel(file, rows => {
    refPayoutData = parseRefPayout(rows);
    document.getElementById('refFileLoaded').classList.add('show');
    document.getElementById('refLoadedName').textContent = file.name;
    document.getElementById('refLoadedMeta').textContent = `${refPayoutData.length} reference rows loaded`;
  }, err => showMsg('refError', 'Error: ' + err, 'error'));
}

// ─────────────────────────────────────────────────────────────────
// EXCEL READER
// ─────────────────────────────────────────────────────────────────
function readExcel(file, onSuccess, onError) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];

      const rows = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: null,
        raw: false,
        dateNF: 'dd/mm/yyyy'
      });

      onSuccess(rows);
    } catch(ex) { onError(ex.message); }
  };
  reader.readAsArrayBuffer(file);
}

// ─────────────────────────────────────────────────────────────────
// PARSE PAYMENT INFO SHEET
// ─────────────────────────────────────────────────────────────────
function parsePaymentSheet(raw) {
  // Find header row
  let hi = 0;
  for (let i = 0; i < Math.min(5, raw.length); i++) {
    if (raw[i] && raw[i].some(v => v && String(v).toLowerCase().includes('client name'))) { hi = i; break; }
  }
  const headers = raw[hi].map(h => h ? String(h).toLowerCase().trim() : '');
  const col = name => headers.findIndex(h => h.includes(name));

  const C = {
    clientName:      col('client name'),
    insurance:       col('insurance paid'),
    healthCheck:     col('health check'),
    payReceived:     col('payment received date'),
    container:       col('product identification number'),
    containerType:   col('container type'),
    returnAmt:       col('return amount'),
    firstPayout:     col('first payout date'),
    payoutCycle:     col('payout cycle'),
    contractEnd:     col('contract end date'),
    accountNo:       col('account no'),
    iban:            col('iban'),
    swift:           col('swift code'),
    bankName:        col('bank name'),
    clientType:      col('client type'),
    contractNo:      col('contract no'),
    contractClosed:  col('contract closed'),
	balance:         col('balance amount pending'),
  };

  // Agent column — matched by header name ("Agent Closing"), looked up once
  const agentIdx = headers.findIndex(h => h.includes('agent closing'));

  const today = new Date(); today.setHours(0,0,0,0);

  // ── Fill-down: propagate non-blank values downward for key columns ──
  let lastContractNo   = '';
  let lastContainer    = '';
  let lastClientName   = '';
  let lastContainerType = '';

  const rows = [];

  for (let i = hi + 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r) continue;

    // Fill-down Contract No: use col('contract no') if present, else Column A (index 0)
    let rawContractNo = '';
    if (C.contractNo !== -1 && r[C.contractNo]) {
      rawContractNo = String(r[C.contractNo]).trim();
    } else if (r[0]) {
      rawContractNo = String(r[0]).trim();
    }
    const NO_FILLDOWN_CLIENTS = new Set([
          'Jasem Mohammed Saif Mohamed Almehrzi',
        ]);
        const isNoNumber = rawContractNo.toLowerCase() === 'no number';
        const clientNameRaw = r[C.clientName] ? String(r[C.clientName]).trim() : lastClientName;
        if (rawContractNo && !(isNoNumber && NO_FILLDOWN_CLIENTS.has(clientNameRaw))) lastContractNo = rawContractNo;
        const contractNo = lastContractNo;

    // Fill-down Container Number — track whether this row's cell was actually filled (#2)
    let rawContainer = (C.container !== -1 && r[C.container]) ? String(r[C.container]).trim() : '';
    const pinFilledDown = !rawContainer;
    if (rawContainer) lastContainer = rawContainer;
    else rawContainer = lastContainer;
    const container = rawContainer;

    // Fill-down Container Type (#1 needs this for size-based insurance)
    let rawContainerType = (C.containerType !== -1 && r[C.containerType]) ? String(r[C.containerType]).trim() : '';
    if (rawContainerType) lastContainerType = rawContainerType;
    else rawContainerType = lastContainerType;
    const containerType = rawContainerType;

    // Fill-down Client Name
    let rawClientName = r[C.clientName] ? String(r[C.clientName]).trim() : '';
    if (rawClientName) lastClientName = rawClientName;
    else rawClientName = lastClientName;
    const clientName = rawClientName;

    if (!clientName) continue;

    // ── Contract Closed check ──
    const closedRaw = (C.contractClosed !== -1 && r[C.contractClosed])
      ? String(r[C.contractClosed]).toLowerCase().trim() : '';
    const SKIP_CLOSED = ['duplicate entry', 'closed', 'yes', 'contract closed'];
    if (closedRaw && SKIP_CLOSED.some(s => closedRaw.includes(s))) continue;
    const contractClosedFlag = closedRaw && !SKIP_CLOSED.some(s => closedRaw.includes(s))
      ? `⚑ Contract Closed field: "${r[C.contractClosed]}" — review` : '';

    // ── Contract end date: no longer skipped here (#4/#5 handled as a flag in runGenerate) ──
    const contractEnd = parseDate(r[C.contractEnd]);

    // Skip rows with no IBAN and no account number (incomplete data)
    let iban = r[C.iban] ? String(r[C.iban]).trim() : '';
    let accountNo = r[C.accountNo] ? String(r[C.accountNo]).trim() : '';

    if (accountNo && accountNo.includes('E+')) {
      accountNo = Number(accountNo).toLocaleString('fullwide', {useGrouping:false});
    }
    if (iban && iban.includes('E+')) {
      iban = Number(iban).toLocaleString('fullwide', {useGrouping:false});
    }
    if (!iban && !accountNo) continue;

    const firstPayout  = parseDate(r[C.firstPayout]);
    const payReceived  = parseDate(r[C.payReceived]);
    const payoutCycle  = r[C.payoutCycle] ? String(r[C.payoutCycle]).trim() : '';
    const insuranceRaw = r[C.insurance];
    const insuranceYearsCovered = parseInsuranceYears(insuranceRaw);

    // Flexible/percentage rent detection (#3)
    const returnRaw  = r[C.returnAmt] ? String(r[C.returnAmt]).trim() : '';
    const returnBase = returnRaw.split('(')[0].trim();
    const returnNum  = parseFloat(returnBase.replace(/[^0-9.\-]/g, ''));
    const isFlexible = /\d+%/.test(returnRaw) || (!isNaN(returnNum) && returnNum > 0 && returnNum < 1);
    const returnAmt  = isFlexible ? 0 : parseNumber(r[C.returnAmt]);

    // ── Group ID priority: Container → Contract No → Manual Check ──
    const noNumber = (s) => !s || s.toLowerCase() === 'no number' || s === '';
    let groupId;
    if (!noNumber(contractNo) && !noNumber(container)) {
      groupId = contractNo + '|' + container;
    } else if (!noNumber(contractNo)) {
      groupId = contractNo;
    } else if (!noNumber(container)) {
      groupId = container;
    } else {
      groupId = '__MANUAL_CHECK__';
    }
    const rawAgent = (agentIdx !== -1 && r[agentIdx]) ? String(r[agentIdx]).trim() : '';

    // Shared container check (#2)
    const isSharedContainer = (container && SHARED_CONTAINERS[container] !== undefined)
      || Object.values(SHARED_CONTAINERS).some(names => names.includes(clientName));

    rows.push({
      index: i,
      clientName,
      contractNo,
      groupId,
      insuranceYearsCovered,
      payReceived,
      container,
      containerType,
      returnAmt,
      returnRaw,
      isFlexible,
      firstPayout,
      payoutCycle,
      contractEnd,
      accountNo,
      iban,
      swift:              r[C.swift]      ? String(r[C.swift]).trim() : '',
      bankName:           r[C.bankName]   ? String(r[C.bankName]).trim() : '',
      clientType:         r[C.clientType] ? String(r[C.clientType]).trim() : '',
      contractClosedFlag,
      balanceNote: (C.balance !== -1 && r[C.balance]) ? String(r[C.balance]).trim() : '',
      agent: rawAgent,
      isSharedContainer,
      pinFilledDown,
    });
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────
// PARSE REFERENCE PAYOUT (previous export)
// ─────────────────────────────────────────────────────────────────
function parseRefPayout(raw) {
  let hi = 0;
  for (let i = 0; i < Math.min(5, raw.length); i++) {
    if (raw[i] && raw[i].some(v => v && String(v).toLowerCase().includes('iban'))) { hi = i; break; }
  }
  const headers = raw[hi].map(h => h ? String(h).toLowerCase().trim() : '');
  const ibanIdx  = headers.findIndex(h => h.includes('iban'));
  const noteIdx  = headers.findIndex(h => h.includes('note'));
  if (ibanIdx === -1 || noteIdx === -1) return [];

  const rows = [];
  for (let i = hi + 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || !r[ibanIdx]) continue;
    const iban = String(r[ibanIdx]).trim();
    const note = r[noteIdx] ? String(r[noteIdx]).trim() : '';
    if (iban && note.toLowerCase().includes('hc')) {
      rows.push({ iban, note });
    }
  }
  return rows;
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
  if (isNaN(n) || n === 0) {
    if (s.includes('paid')) return 1;
    return 0;
  }
  if (n >= 4000) return 3;
  if (n >= 2500) return 2;
  if (n >= 1000) return 1;
  return 0;
}

// ─────────────────────────────────────────────────────────────────
// INSURANCE SIZE-BASED PRICING (#1)
// Flat 1,500 before 30 Jun 2026. After that: 20ft=1,500, 40ft=1,800, specialty=2,600
// ─────────────────────────────────────────────────────────────────
const NEW_INSURANCE_FROM = new Date(2026, 5, 30); // 30 Jun 2026

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

// ─────────────────────────────────────────────────────────────────
// DEDUCTION SCHEDULE
// ─────────────────────────────────────────────────────────────────
function calcDeduction(payoutDate, firstPayout, insuranceYearsCovered, isHealthCheckEligible, hcPendingFromRef, containerType) {
  if (!firstPayout) return { amount: 0, items: [] };

  const yr = parseInt(document.getElementById('selYear').value);
  const mo = parseInt(document.getElementById('selMonth').value);

  function samePayoutMonth(d) {
    if (!d) return false;
    return d.getFullYear() === yr && d.getMonth() + 1 === mo;
  }

  const y1Date = new Date(firstPayout);
  const y2Date = subtractOneMonth(addYears(firstPayout, 1)); // 1 month before 2nd anniversary
  const y3Date = addYears(firstPayout, 2);                   // on 3rd year anniversary

  const items = [];
  const insAmt = insuranceAmount(containerType, firstPayout);

  // Insurance
  if (insuranceYearsCovered < 1 && samePayoutMonth(y1Date)) {
    items.push({ type: 'Y1 Insurance', amount: insAmt, firstPayout });
  }
  if (insuranceYearsCovered < 2 && samePayoutMonth(y2Date)) {
    items.push({ type: 'Y2 Insurance', amount: insAmt, firstPayout });
  }
  if (insuranceYearsCovered < 3 && samePayoutMonth(y3Date)) {
    items.push({ type: 'Y3 Insurance', amount: insAmt, firstPayout });
  }

  const insuranceTotal = items.reduce((s, it) => s + it.amount, 0);

  // Health check (eligible: payReceived <= June 2025)
  if (isHealthCheckEligible) {
    const hc1 = new Date(firstPayout);
    const hc2 = subtractOneMonth(addYears(firstPayout, 1));
    const hc3 = addYears(firstPayout, 2);
    const hcDueThisCycle = samePayoutMonth(hc1) || samePayoutMonth(hc2) || samePayoutMonth(hc3);

    if (hcPendingFromRef) {
      items.push({ type: 'HC', amount: 1000, firstPayout, note: 'applied from previous payout' });
    } else if (hcDueThisCycle && insuranceTotal > 0) {
      items.push({ type: 'HC Pending', amount: 0, firstPayout, note: 'pending — deduct next cycle' });
    } else if (hcDueThisCycle) {
      items.push({ type: 'HC', amount: 1000, firstPayout });
    }
  }

  const totalAmount = items.reduce((s, it) => s + it.amount, 0);
  return { amount: totalAmount, items };
}

function addYears(date, n) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + n);
  return d;
}

function subtractOneMonth(date) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() - 1);
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

// ─────────────────────────────────────────────────────────────────
// GROUP ID ANALYSIS
// ─────────────────────────────────────────────────────────────────
function analyzeGroups(rows) {
  const groupMap = {};
  rows.forEach(r => {
    if (r.groupId === '__MANUAL_CHECK__') return;
    if (!groupMap[r.groupId]) {
      groupMap[r.groupId] = { clients: new Set(), contractNos: new Set(), rows: [] };
    }
    const ibanValid  = r.iban && /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(r.iban.replace(/\s/g, ''));
    const clientKey  = ibanValid ? r.iban.replace(/\s/g, '') : (r.accountNo || r.clientName);
    groupMap[r.groupId].clients.add(clientKey);
    groupMap[r.groupId].contractNos.add(r.contractNo || '__NONE__');
    groupMap[r.groupId].rows.push(r);
  });

  const sharedGroups  = {};
  const mismatchFlags = [];

  Object.entries(groupMap).forEach(([gid, meta]) => {
    const isContainerBased = meta.rows.some(r => r.container && r.container === gid);

    if (isContainerBased && meta.contractNos.size > 1 && !new Set(['LGMU2266157', 'LGMU2279473', 'LGMU2272308', 'LGMU2271894', 'LGMU2276920', 'HKAU2024746']).has(gid)) {
      mismatchFlags.push({
        container:    gid,
        contractNos:  [...meta.contractNos].filter(c => c !== '__NONE__'),
        clientNames:  [...meta.clients],
      });
    } else if (meta.clients.size > 1) {
      sharedGroups[gid] = meta;
    }
  });

  return { sharedGroups, mismatchFlags };
}

// ─────────────────────────────────────────────────────────────────
// MAIN GENERATE
// ─────────────────────────────────────────────────────────────────
function runGenerate() {
  if (!paymentData.length) { showMsg('genError', 'Please upload the payment info sheet first.', 'error'); return; }
  showMsg('genError', '');

  const yr    = parseInt(document.getElementById('selYear').value);
  const mo    = parseInt(document.getElementById('selMonth').value);
  const cycle = document.getElementById('selCycle').value;

  const payoutDay  = cycle === '15' ? 15 : new Date(yr, mo, 0).getDate();
  const payoutDate = new Date(yr, mo - 1, payoutDay);

  const hcCutoff = new Date(2025, 5, 30);

  const hcPendingMap = {};
  refPayoutData.forEach(r => { 
    const k = r.iban ? r.iban.replace(/\s/g, '') : '';
    if (k) hcPendingMap[k] = true;
  });

  // Filter by cycle + skip flexible rent (#3) + skip fill-down unless shared (#2)
  const filtered = paymentData.filter(r => {
    if (r.isFlexible) return false;
    if (r.pinFilledDown && !r.isSharedContainer) return false;

    const c = String(r.payoutCycle).replace(/\s/g, '');
    const cycleMatch = cycle === '15'
      ? c === '15'
      : (c === '30/31' || c === '30' || c === '31');
    const alreadyStarted = !r.firstPayout || r.firstPayout <= payoutDate;
    return cycleMatch && alreadyStarted;
  });

  const { sharedGroups, mismatchFlags } = analyzeGroups(filtered);
  const mismatchContainers = new Set(mismatchFlags.map(f => f.container));

  const groups = {};
  filtered.forEach(r => {
    const ibanValid = r.iban && /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(r.iban.replace(/\s/g, ''));
    const groupKey  = ibanValid ? r.iban.replace(/\s/g, '') : r.accountNo;
    const key       = groupKey || r.clientName;
    if (!groups[key]) {
      groups[key] = {
        index:           r.index,
        clientName:      r.clientName,
        iban:            r.iban,
        accountNo:       r.accountNo,
        swift:           r.swift,
        bankName:        r.bankName,
        clientType:      r.clientType,
        containers:      [],
        totalReturn:     0,
        totalDeduction:  0,
        deductionItems:  [],
        structuralNotes: [],
		balanceNotes:    new Set(),
        agents:          new Set(),
      };
    }

    groups[key].containers.push(r.container);
    if (r.agent) groups[key].agents.add(r.agent);
    groups[key].totalReturn += r.returnAmt;

    if (r.contractClosedFlag) groups[key].structuralNotes.push(r.contractClosedFlag);

    // Contract end flag (#4/#5) — flag, don't skip; skip the check for commission rows
    const isCommission = r.container && r.container.toLowerCase() === 'commission';
    if (!isCommission && r.contractEnd && r.contractEnd < payoutDate) {
      groups[key].structuralNotes.push('⚑ Contract end date has passed — verify');
    }

    if (r.balanceNote) {
      const fp = r.firstPayout;
      const isThisCycle = fp && fp.getFullYear() === yr && fp.getMonth() + 1 === mo
        && (cycle === '15' ? fp.getDate() === 15 : fp.getDate() === payoutDay);
      if (isThisCycle) groups[key].balanceNotes.add(r.balanceNote);
    }

    if (r.groupId === '__MANUAL_CHECK__') {
      groups[key].structuralNotes.push('⚑ No container or contract number — manual check required');
    }

    const isHcEligible = r.payReceived && r.payReceived <= hcCutoff;
    const cleanIban    = r.iban ? r.iban.replace(/\s/g, '') : '';
    const hcPending    = hcPendingMap[cleanIban] || false;

    if (r.container && mismatchContainers.has(r.container)) {
      const mf = mismatchFlags.find(f => f.container === r.container);
      groups[key].structuralNotes.push(
        `⚑ Duplicate container mismatch — container ${r.container} appears under different contracts (${mf.contractNos.join(' / ')}) — manual check`
      );
      const ded = calcDeduction(payoutDate, r.firstPayout, r.insuranceYearsCovered, isHcEligible, hcPending, r.containerType);
      groups[key].totalDeduction += ded.amount;
      groups[key].deductionItems.push(...ded.items);

    } else if (r.groupId !== '__MANUAL_CHECK__' && sharedGroups[r.groupId]) {
      const sg = sharedGroups[r.groupId];
      if (!sg.deductionCalculated) {
        const ded = calcDeduction(payoutDate, r.firstPayout, r.insuranceYearsCovered, isHcEligible, hcPending, r.containerType);
        sg.deductionAmount = ded.amount;
        sg.deductionItems  = ded.items;
        sg.deductionCalculated = true;
      }
      const WEIGHTED_SPLITS = {
        'CONMO0379': {
          'Mohamed Rafi Hakeem':                    0.75,
          'Sundarrajan Dharmarajan Dhayalakumaran': 0.25
        },
        'CONRA181': {
          'Rashedur Rahman Chowdhury':              0.50,
          'Reshad Abd Alim': 						0.25,
          'Adnan Amin Ziaul Amin': 					0.25
        },
        'CONMRTMN0529': {
          'Muhammad Rameez Tahir Muhammad Naeem':              					0.3333,
          'Muhammad Jawad Tahir': 												0.3333,
          'Muhammad Junaid Jamshaid Hafiz Jamshaid Akhtar': 					0.3333
        },
		'CONNU0415': {
          'Nuzhat Mursaleen Faisal Fakir Mohammed':         0.61,
          'Barayil Porakandy Roshan Valiyakath Aboobacker': 0.39
        }
      };
      const contractKey = r.contractNo || [...sg.contractNos].find(c => c !== '__NONE__') || '';
      const weightMap   = WEIGHTED_SPLITS[contractKey];
      const clientShare = weightMap ? (weightMap[r.clientName] ?? (1 / sg.clients.size)) : (1 / sg.clients.size);
      const splitLabel  = weightMap
        ? Object.values(weightMap).map(v => Math.round(v * 100)).join('-')
        : `${sg.clients.size} ways`;
      const splitItems = sg.deductionItems.map(it => ({ ...it, amount: it.amount * clientShare }));
      groups[key].totalDeduction += sg.deductionAmount * clientShare;
      groups[key].deductionItems.push(...splitItems);
      if (sg.deductionAmount > 0) {
        groups[key].structuralNotes.push(`⚑ Shared group ${r.groupId} — deduction split ${splitLabel}`);
      }

    } else {
      const ded = calcDeduction(payoutDate, r.firstPayout, r.insuranceYearsCovered, isHcEligible, hcPending, r.containerType);
      groups[key].totalDeduction += ded.amount;
      groups[key].deductionItems.push(...ded.items);
    }
  });

  function fmtDate(d) {
    if (!d) return '?';
    return String(d.getDate()).padStart(2,'0') + '/' +
           String(d.getMonth()+1).padStart(2,'0') + '/' +
           String(d.getFullYear()).slice(-2);
  }

  results = Object.values(groups).map(g => {
    const roundedDeduction = Math.round(g.totalDeduction);

    const y1Items   = g.deductionItems.filter(it => it.type === 'Y1 Insurance');
    const ipItems   = g.deductionItems.filter(it => it.type === 'Y2 Insurance' || it.type === 'Y3 Insurance');
    const hcApplied = g.deductionItems.filter(it => it.type === 'HC');
    const hcPending = g.deductionItems.filter(it => it.type === 'HC Pending');

    const y1WithOthers = y1Items.length > 0 && ipItems.length > 0;

    const visibleItems       = [...y1Items, ...ipItems, ...hcApplied];
    const activeDates        = [...new Set(visibleItems.map(it => fmtDate(it.firstPayout)))];
    const firstPayoutDisplay = activeDates.join(' & ') || '';

    const deductionNotes = [];

    if (ipItems.length > 0) {
      const hasY1    = y1WithOthers;
      const hasY2    = ipItems.some(it => it.type === 'Y2 Insurance');
      const hasY3    = ipItems.some(it => it.type === 'Y3 Insurance');
      const typeStr  = [hasY1 ? 'Y1' : null, hasY2 ? 'Y2' : null, hasY3 ? 'Y3' : null].filter(Boolean).join(' & ');
      const allItems = [...(y1WithOthers ? y1Items : []), ...ipItems];
      const totalAmt = Math.round(allItems.reduce((s, it) => s + it.amount, 0));
      const dates    = [...new Set(allItems.map(it => fmtDate(it.firstPayout)))];
      const dateStr  = dates.join(' & ');

      let ipNote = `${typeStr} IP ${totalAmt.toLocaleString()} from ${dateStr}`;
      if (hcPending.length > 0) ipNote += ' — HC pending next cycle';
      deductionNotes.push(ipNote);

    } else if (hcPending.length > 0) {
      deductionNotes.push('HC pending next cycle');
    }

    if (hcApplied.length > 0) {
      deductionNotes.push('HC 1,000 applied');
    }

    const agentArr = [...g.agents];
    if (agentArr.length > 1) g.structuralNotes.push(`⚑ Multiple agents: ${agentArr.join(' / ')}`);
    const agent = agentArr.length >= 1 ? agentArr[agentArr.length - 1] : '';

    const balanceNoteArr = [...g.balanceNotes];
    const allNotes = [...new Set(g.structuralNotes), ...deductionNotes, ...balanceNoteArr].join(' | ');

    const balanceNumeric = balanceNoteArr.length > 0
      ? (() => { const m = balanceNoteArr.join(' ').match(/[\d]+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; })()
      : null;
    const hasBalance = balanceNumeric !== null;

    return {
      ...g,
      agent,
      totalDeduction:    roundedDeduction,
      rentalDue:         hasBalance ? null : (g.totalReturn - roundedDeduction),
      balanceAddition:   balanceNumeric,
      firstPayoutDisplay,
      note:              allNotes,
    };
  });

  results.sort((a, b) => a.index - b.index);

  renderResults(yr, mo, cycle, payoutDate, sharedGroups, mismatchFlags);
}

// ─────────────────────────────────────────────────────────────────
// RENDER RESULTS
// ─────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function renderResults(yr, mo, cycle, payoutDate, sharedGroups, mismatchFlags) {
  document.getElementById('resultsSection').classList.add('show');

  const cycleLabel = cycle === '15' ? '15th' : 'End of Month';
  document.getElementById('resultsTitle').textContent =
    `${MONTHS[mo-1]} ${yr} — ${cycleLabel} · ${results.length} payees`;

  const totalReturn = results.reduce((s,r) => s + r.totalReturn, 0);
  const totalDeduct = results.reduce((s,r) => s + r.totalDeduction, 0);
  const totalDue    = results.reduce((s,r) => s + (r.rentalDue || 0), 0);
  const withDeduct  = results.filter(r => r.totalDeduction > 0).length;
  const withNotes   = results.filter(r => r.note).length;

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-box"><span class="stat-val">${results.length}</span><span class="stat-lbl">Payees</span></div>
    <div class="stat-box"><span class="stat-val">AED ${fmt(totalReturn)}</span><span class="stat-lbl">Total Rental</span></div>
    <div class="stat-box"><span class="stat-val">AED ${fmt(totalDeduct)}</span><span class="stat-lbl">Total Deductions</span></div>
    <div class="stat-box"><span class="stat-val">AED ${fmt(totalDue)}</span><span class="stat-lbl">Total Due</span></div>
    <div class="stat-box"><span class="stat-val">${withDeduct}</span><span class="stat-lbl">With Deductions</span></div>
    <div class="stat-box"><span class="stat-val">${withNotes}</span><span class="stat-lbl">With Notes</span></div>
  `;

  const sharedCount   = Object.keys(sharedGroups).length;
  const mismatchCount = mismatchFlags.length;
  const flagLines     = [];

  if (sharedCount > 0) {
    const names = Object.entries(sharedGroups).map(([gid, meta]) =>
      `${gid} (${[...meta.clients].join(' / ')})`).join('; ');
    flagLines.push(`⚑ ${sharedCount} shared group(s) — deduction split: ${names}`);
  }
  if (mismatchCount > 0) {
    mismatchFlags.forEach(f => {
      flagLines.push(`🔴 Duplicate container mismatch: ${f.container} — contracts ${f.contractNos.join(' / ')} — clients: ${f.clientNames.join(' / ')} — manual check required`);
    });
  }

  if (flagLines.length > 0) {
    document.getElementById('sharedFlagsBox').style.display = 'block';
    document.getElementById('sharedFlagsMsg').innerHTML = flagLines.map(l => `<div>${esc(l)}</div>`).join('');
  } else {
    document.getElementById('sharedFlagsBox').style.display = 'none';
  }

  const previewCount = 10;
  const preview = results.slice(0, previewCount);
  document.getElementById('previewBody').innerHTML = preview.map((r, i) => `
    <tr>
	  <td style="color:var(--text-hint);font-family:var(--font-mono);font-size:11px;">${i+1}</td>
      <td class="td-name">${esc(r.clientName)}</td>
      <td class="td-num">${r.containers.length}</td>
      <td class="td-mono">${r.firstPayoutDisplay || '—'}</td>
      <td class="td-num">${fmt(r.totalReturn)}</td>
      <td class="td-deduct">${r.totalDeduction > 0 ? fmt(r.totalDeduction) : '—'}</td>
      <td class="td-due">${fmt(r.rentalDue)}</td>
      <td class="td-note">${renderNote(r.note)}</td>
    </tr>
  `).join('');

  if (results.length > previewCount) {
    document.getElementById('moreRows').style.display = 'block';
    document.getElementById('moreRows').textContent =
      `+ ${results.length - previewCount} more rows · all included in export`;
  } else {
    document.getElementById('moreRows').style.display = 'none';
  }

  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderNote(note) {
  if (!note) return '<span style="color:var(--text-hint)">—</span>';
  const cls = note.includes('⚑') ? 'badge-flag' : note.includes('pending') ? 'badge-warn' : 'badge-info';
  return `<span class="badge ${cls}">${esc(note)}</span>`;
}

// ─────────────────────────────────────────────────────────────────
// EXPORT TO EXCEL
// ─────────────────────────────────────────────────────────────────
function exportExcel() {
  if (!results.length) return;

  const yr    = parseInt(document.getElementById('selYear').value);
  const mo    = parseInt(document.getElementById('selMonth').value);
  const cycle = document.getElementById('selCycle').value;
  const cycleLabel = cycle === '15' ? '15th' : 'EOM';

  const headers = [
    'CLIENT TYPE',
    'NAME OF CLIENTS',
    'UNITS',
    'FIRST PAYOUT DATE',
    'MONTHLY RENTAL AMOUNT',
    'DEDUCTION',
    'ADDITION',
    'RENTAL DUE',
    'ACCOUNT NUMBER',
    'IBAN NUMBER',
    'SWIFT CODE',
    'BANK NAME',
    'Agent Name',
    'NOTES',
  ];

  const rows = results.map(r => [
    r.clientType || '',
    r.clientName,
    r.containers.length,
    r.firstPayoutDisplay || '',
    r.totalReturn,
    r.totalDeduction || null,
    r.balanceAddition || null,
    r.rentalDue !== null ? r.rentalDue : null,
    r.accountNo,
    r.iban,
    r.swift,
    r.bankName,
    r.agent || '',
    r.note || '',
  ]);

  const totReturn = results.reduce((s,r) => s + r.totalReturn, 0);
  const totDeduct = results.reduce((s,r) => s + r.totalDeduction, 0);
  const totDue    = results.reduce((s,r) => s + (r.rentalDue || 0), 0);
  rows.push(['', 'TOTAL', '', '', totReturn, totDeduct, '', totDue, '', '', '', '', '', '']);

  const wb   = XLSX.utils.book_new();
  const data = [headers, ...rows];
  const ws   = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [
    { wch: 14 },
    { wch: 45 },
    { wch: 8 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 22 },
    { wch: 30 },
    { wch: 18 },
    { wch: 28 },
    { wch: 20 },
    { wch: 50 },
  ];

  const sheetName = `${MONTHS[mo-1]} ${yr} - ${cycleLabel}`.substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const cycleTag = cycle === '15' ? '15' : '30';
  const filename = `PAYOUT_${cycleTag}_${MONTHS[mo-1].toUpperCase()}${yr}.xlsx`;
  XLSX.writeFile(wb, filename);
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

  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let a = parseInt(m[1]);
    let b = parseInt(m[2]);
    let y = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);

    if (a > 12) return new Date(y, b - 1, a);
    if (b > 12) return new Date(y, a - 1, b);

    return new Date(y, b - 1, a);
  }

  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));

  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  return parseFloat(String(val).replace(/[^0-9.\-]/g, '')) || 0;
}

function fmt(n) { return Math.round(n).toLocaleString(); }

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'msg' + (text ? ` show ${type||'error'}` : '');
}

document.getElementById('generateBtn').disabled = true;

if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed; inset:0; background:var(--bg);
    z-index:9999; display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    padding:2rem; text-align:center;
  `;
  overlay.innerHTML = `
    <div style="font-size:48px;margin-bottom:1rem;">💻</div>
    <div style="font-size:20px;font-weight:600;color:var(--text);margin-bottom:0.5rem;">Desktop Recommended</div>
    <div style="font-size:14px;color:var(--text-muted);margin-bottom:1.5rem;max-width:280px;line-height:1.6;">
      This tool is best viewed on a PC or laptop.
    </div>
    <button onclick="history.back()" style="padding:0 24px;height:42px;font-size:14px;">
      ← Go Back
    </button>
  `;
  document.body.appendChild(overlay);
}

  fetch('/components/footer.html')
    .then(res => res.text())
    .then(data => {
      document.getElementById('footer').innerHTML = data;
    });
