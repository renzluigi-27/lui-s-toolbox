// ─────────────────────────────────────────────────────────────────
// APP CORE — app.js
// State, init, file uploads, UI management, rendering
// Depends on: shared.js
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────
let paymentData   = [];
let refData       = [];
let emailData     = [];
let results       = [];
let activeMode    = 'payout';
let rerouteData   = [];
let rerouteMap    = {};
let auditInited   = false;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const PREVIEW_COUNT = 10;

// ─────────────────────────────────────────────────────────────────
// SHARED CONTAINERS — reference map
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
  'LGMU2284675': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284680': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284696': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284700': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284715': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284720': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284736': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284741': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284757': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284762': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284778': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284783': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284799': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284802': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284818': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284823': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284839': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284844': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284850': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284865': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284870': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284886': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284891': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284905': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284910': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284926': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284931': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284947': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284952': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
  'LGMU2284968': ['Yury Shevchuk', 'Romuald Jankovskij', 'Igor Shved'],
};

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
    if (btn.dataset.mode === activeMode) return;
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const leaving = [...document.querySelectorAll('.container .card')]
      .filter(c => window.getComputedStyle(c).display !== 'none');
    leaving.forEach(c => c.classList.add('card-fade-out'));
    setTimeout(() => {
      activeMode = btn.dataset.mode;
      updateTabUI();
      clearResults();
      resetRefUpload();
      animateCards();
    }, 140);
  });
});

function updateTabUI() {
  const isAudit = activeMode === 'audit';
  const isTrip  = activeMode === 'trip';
  const isEmail = activeMode === 'email';

  const genCards = [
    document.querySelector('.upload-row'),
    document.getElementById('cycleCard'),
    document.getElementById('refUploadZone').closest('.card'),
    document.getElementById('generateBtn').closest('.card'),
  ];
  genCards.forEach(el => { if (el) el.style.display = (isAudit || isTrip || isEmail) ? 'none' : ''; });

  const auditMount = document.getElementById('auditMount');
  if (auditMount) {
    auditMount.style.display = isAudit ? 'block' : 'none';
    if (isAudit && !auditInited && window.PayoutAuditor) {
      PayoutAuditor.init('auditMount');
      auditInited = true;
    }
  }

  const tripMount = document.getElementById('tripMount');
  if (tripMount) {
    tripMount.style.display = isTrip ? 'block' : 'none';
    if (isTrip && window.ContainerTripUpdater) ContainerTripUpdater.init('tripMount');
  }

  const emailMount = document.getElementById('emailMatcherMount');
  if (emailMount) {
    emailMount.style.display = isEmail ? 'block' : 'none';
    if (isEmail && window.EmailMatcherStandalone) EmailMatcherStandalone.init('emailMatcherMount');
  }

  document.getElementById('emailSheetCard').style.display =
    (activeMode === 'payout' || activeMode === 'ip') ? 'block' : 'none';
  const rerouteCard = document.getElementById('rerouteSheetCard');
  if (rerouteCard) rerouteCard.style.display = (activeMode === 'payout' || activeMode === 'ip') ? 'block' : 'none';
  updateRefHint();
  updateGenerateBtn();
}

function animateCards() {
  const cards = [...document.querySelectorAll('.container .card')].filter(
    c => window.getComputedStyle(c).display !== 'none'
  );
  cards.forEach(card => {
    card.classList.remove('card-animate', 'card-fade-out');
    void card.offsetWidth;
  });
  cards.forEach((card, i) => {
    setTimeout(() => card.classList.add('card-animate'), i * 65);
  });
}

function updateRefHint() {
  if (activeMode === 'audit' || activeMode === 'email') return;
  const expected = getExpectedRefFilename();
  document.getElementById('refExpected').textContent = expected ? `e.g. ${expected}` : '—';
  const hints = {
    payout:    'Upload the previous cycle\'s payout export to auto-detect pending HC deductions.',
    ip:        'Upload the previous cycle\'s IP Deduction export for reference.',
    container: 'Upload the previous cycle\'s Container Info export for reference.',
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
  const prefixes = { payout:'PAYOUT', ip:'IP_DEDUCTION', container:'CONTAINER_INFO' };
  return `${prefixes[activeMode]}_${cycleTag}_${prevMonth}${prevYear}.xlsx`;
}

function getExpectedOutputFilename() {
  const mo    = parseInt(document.getElementById('selMonth').value);
  const yr    = parseInt(document.getElementById('selYear').value);
  const cycle = document.getElementById('selCycle').value;
  const cycleTag = cycle === '15' ? '15' : '30';
  const monthStr = MONTHS[mo - 1].toUpperCase();
  const prefixes = { payout:'PAYOUT', ip:'IP_DEDUCTION', container:'CONTAINER_INFO' };
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
  const hasPayment    = paymentData.length > 0;
  const hasReroute    = rerouteData.length > 0;
  const needsReroute  = activeMode === 'payout' || activeMode === 'ip';
  const ready = hasPayment && (!needsReroute || hasReroute);
  document.getElementById('generateBtn').disabled = !ready;
  document.getElementById('generateHint').textContent = ready
    ? 'Ready to generate'
    : !hasPayment
      ? 'Upload payment info sheet to continue'
      : needsReroute && !hasReroute
        ? 'Upload updated payment info sheet to continue'
        : 'Upload required files to continue';
}

// ─────────────────────────────────────────────────────────────────
// FILENAME MISMATCH CHECK (non-blocking helper)
// ─────────────────────────────────────────────────────────────────
function checkFilenameHint(file, expectedPrefixRegex, msgElId) {
  const baseName = file.name.replace(/\.(xlsx|xls)$/i, '').toUpperCase();
  if (expectedPrefixRegex && !expectedPrefixRegex.test(baseName)) {
    showMsg(msgElId, `⚠ Filename doesn't match the expected pattern — loaded anyway`, 'warn');
    return false;
  }
  return true;
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
// FILE UPLOAD — updated payment info sheet (reroute, payout/ip only)
// ─────────────────────────────────────────────────────────────────
const rerouteZone = document.getElementById('rerouteUploadZone');
rerouteZone.addEventListener('dragover',  e => { e.preventDefault(); rerouteZone.classList.add('dragover'); });
rerouteZone.addEventListener('dragleave', () => rerouteZone.classList.remove('dragover'));
rerouteZone.addEventListener('drop', e => {
  e.preventDefault(); rerouteZone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleRerouteFile(e.dataTransfer.files[0]);
});
document.getElementById('rerouteFileInput').addEventListener('change', e => {
  if (e.target.files[0]) handleRerouteFile(e.target.files[0]);
});

function handleRerouteFile(file) {
  showMsg('rerouteError', '');
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    showMsg('rerouteError', 'Please upload an Excel file (.xlsx or .xls)', 'error'); return;
  }
  readExcel(file, rows => {
    rerouteData = rows;
    rerouteMap  = parseRerouteSheet(rows);
    document.getElementById('rerouteFileLoaded').classList.add('show');
    document.getElementById('rerouteLoadedName').textContent = file.name;
    document.getElementById('rerouteLoadedMeta').textContent = `${Object.keys(rerouteMap.byKey || {}).length} rerouted container(s) loaded`;
    updateGenerateBtn();
  }, err => showMsg('rerouteError', 'Error reading file: ' + err, 'error'));
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
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    showMsg('refError', 'Reference file must be .xlsx or .xls', 'error'); return;
  }
  const expected = getExpectedRefFilename();
  const prefixes = { payout:'PAYOUT_', ip:'IP_DEDUCTION_', container:'CONTAINER_INFO_' };
  const prefix   = prefixes[activeMode];
  const baseName = file.name.replace(/\.xlsx$/i, '').toUpperCase();
  if (!baseName.match(new RegExp(prefix))) {
    showMsg('refError', `Wrong file. Expected a file with "${prefix}" — e.g. ${expected}`, 'error'); return;
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
// FILE UPLOAD — email sheet (payout / ip modes only — integrated matching)
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
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
      onSuccess(rows);
    } catch(ex) { onError(ex.message); }
  };
  reader.onerror = () => onError('File read error');
  reader.readAsArrayBuffer(file);
}

// ─────────────────────────────────────────────────────────────────
// PARSE PAYMENT INFO SHEET
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
    containerType:  16,
    agent:          37,
    totalTrips:     36,
    payCalcStart:   col('payout calculation start date'),
  };

  const today = new Date(); today.setHours(0,0,0,0);

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

    let rawContractNo = '';
    if (C.contractNo !== -1 && r[C.contractNo]) rawContractNo = String(r[C.contractNo]).trim();
    else if (r[0]) rawContractNo = String(r[0]).trim();

    const NO_FILLDOWN_CLIENTS = new Set(['Jasem Mohammed Saif Mohamed Almehrzi']);
    const isNoNumber    = rawContractNo.toLowerCase() === 'no number';
    const clientNameRaw = r[C.clientName] ? String(r[C.clientName]).trim() : lastClientName;
    if (rawContractNo && !(isNoNumber && NO_FILLDOWN_CLIENTS.has(clientNameRaw))) lastContractNo = rawContractNo;
    const contractNo = lastContractNo;

    let rawContainer = (C.container !== -1 && r[C.container]) ? String(r[C.container]).trim() : '';
    const pinFilledDown = !rawContainer;
    if (rawContainer) lastContainer = rawContainer;
    else rawContainer = lastContainer;
    const container = rawContainer;

    let rawClientName = r[C.clientName] ? String(r[C.clientName]).trim() : '';
    if (rawClientName) lastClientName = rawClientName;
    else rawClientName = lastClientName;
    const clientName = rawClientName;

    if (!clientName) continue;

    const rawCycleDirect = (C.payoutCycle !== -1 && r[C.payoutCycle]) ? String(r[C.payoutCycle]).trim() : '';
    if (rawCycleDirect) lastPayoutCycle = rawCycleDirect;
    const payoutCycle = rawCycleDirect || lastPayoutCycle;

    const rawClientType = (C.clientType !== -1 && r[C.clientType]) ? String(r[C.clientType]).trim() : '';
    const clientTypeBlank = !rawClientType;
    if (rawClientType) lastClientType = rawClientType;
    const clientType = rawClientType || lastClientType;

    const rawContainerType = (C.containerType !== -1 && r[C.containerType]) ? String(r[C.containerType]).trim() : '';
    const containerTypeBlank = !rawContainerType;
    if (rawContainerType) lastContainerType = rawContainerType;
    const containerType = rawContainerType || lastContainerType;

    const closedRaw = (C.contractClosed !== -1 && r[C.contractClosed])
      ? String(r[C.contractClosed]).toLowerCase().trim() : '';
    const SKIP_CLOSED = ['duplicate entry', 'closed', 'yes', 'contract closed'];
    if (closedRaw && SKIP_CLOSED.some(s => closedRaw.includes(s))) continue;
    const contractClosedFlag = closedRaw && !SKIP_CLOSED.some(s => closedRaw.includes(s))
      ? `⚑ Contract Closed field: "${r[C.contractClosed]}" — review` : '';

    const firstPayout  = parseDate(r[C.firstPayout]);
    const payReceived  = parseDate(r[C.payReceived]);
    const contractEndRaw = (C.contractEnd !== -1 && r[C.contractEnd]) ? parseDate(r[C.contractEnd]) : null;
    const contractEnd = contractEndRaw || (payReceived ? addYears(payReceived, 3) : null);
    const payCalcStart = (C.payCalcStart !== -1 && r[C.payCalcStart]) ? parseDate(r[C.payCalcStart]) : null;

    let iban      = r[C.iban]      ? String(r[C.iban]).trim()      : '';
    let accountNo = r[C.accountNo] ? String(r[C.accountNo]).trim() : '';
    if (accountNo && accountNo.includes('E+')) accountNo = Number(accountNo).toLocaleString('fullwide', {useGrouping:false});
    if (iban      && iban.includes('E+'))      iban      = Number(iban).toLocaleString('fullwide', {useGrouping:false});
    const noIban = !iban && !accountNo;

    const totalTripsRaw = (C.totalTrips !== -1 && r[C.totalTrips] != null)
      ? String(r[C.totalTrips]).trim() : null;
    const totalTripsNA  = totalTripsRaw !== null && totalTripsRaw.toLowerCase() === 'n/a';
    const totalTripsNum = totalTripsRaw !== null ? parseInt(totalTripsRaw) : null;
    const totalTrips    = (!totalTripsNA && totalTripsNum !== null && !isNaN(totalTripsNum)) ? totalTripsNum : null;

    const returnRaw  = (C.returnAmt !== -1 && r[C.returnAmt]) ? String(r[C.returnAmt]).trim() : '';
    const returnBase = returnRaw.split('(')[0].trim();
    const returnNum  = parseFloat(returnBase.replace(/[^0-9.\-]/g, ''));
    const isFlexible = /\d+%/.test(returnRaw) || (!isNaN(returnNum) && returnNum > 0 && returnNum < 1);
    const returnAmt  = isFlexible ? 0 : parseNumber(r[C.returnAmt]);
    const returnInUSD = /usd/i.test(returnRaw);

    const insuranceRaw          = r[C.insurance];
    const insuranceYearsCovered = parseInsuranceYears(insuranceRaw);
    const rawAgent              = r[C.agent] ? String(r[C.agent]).trim() : '';
    const balanceNote           = (C.balance !== -1 && r[C.balance]) ? String(r[C.balance]).trim() : '';

    const noNumber = (s) => !s || s.toLowerCase() === 'no number' || s === '';
    let groupId;
    if (!noNumber(contractNo) && !noNumber(container)) groupId = contractNo + '|' + container;
    else if (!noNumber(contractNo)) groupId = contractNo;
    else if (!noNumber(container))  groupId = container;
    else groupId = '__MANUAL_CHECK__';

    const isSharedContainer = (container && SHARED_CONTAINERS[container] !== undefined)
      || Object.values(SHARED_CONTAINERS).some(names => names.includes(clientName));

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
      containerTypeBlank,
      returnAmt,
      returnRaw,
      returnInUSD,
      isFlexible,
      firstPayout,
      payoutCycle,
      contractEnd,
      accountNo,
      iban,
      swift:         r[C.swift]    ? String(r[C.swift]).trim()    : '',
      bankName:      r[C.bankName] ? String(r[C.bankName]).trim() : '',
      clientType,
      clientTypeBlank,
      contractClosedFlag,
      balanceNote,
      noIban,
      totalTrips,
      totalTripsNA,
      isSharedContainer,
      pinFilledDown,
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
}

// ─────────────────────────────────────────────────────────────────
// EXPORT — dispatcher
// ─────────────────────────────────────────────────────────────────
function exportResults() {
  if (!results.length) return;
  if      (activeMode === 'payout')    exportPayout();
  else if (activeMode === 'ip')        exportIPDeduction();
  else if (activeMode === 'container') exportContainerInfo();
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
