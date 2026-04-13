let paymentSheetData = null;
let emailSheetData = null;
let results = [];
let payoutFileName = '';

const NAME_PREFIXES = /^(mr\.?|mrs\.?|ms\.?)\s+/i;
const PREVIEW_LIMIT = 10;

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function normalizeName(value, stripPrefixes = false) {
  let name = String(value || '').trim();
  if (stripPrefixes) {
    name = name.replace(NAME_PREFIXES, '');
  }
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseDateValue(value) {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return '';
    return formatDateParts(parsed.d, parsed.m, parsed.y);
  }

  const raw = String(value).trim();
  if (!raw) return '';

  const match = raw.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/);
  if (match) {
    let a = parseInt(match[1], 10);
    let b = parseInt(match[2], 10);
    let c = parseInt(match[3], 10);

    let day, month, year;

    if (match[1].length === 4) {
      year = a; month = b; day = c;
    } else {
      day = a; month = b; year = c;
    }

    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }

    return formatDateParts(day, month, year);
  }

  return '';
}

function formatDateParts(day, month, year) {
  if (!day || !month || !year) return '';
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year).padStart(4, '0');
  return `${dd}/${mm}/${yyyy}`;
}

function splitEmails(value) {
  const text = String(value || '').trim();
  if (!text) return ['', ''];
  const parts = text
    .split(/[,:;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return [parts[0] || '', parts[1] || ''];
}

function fillDownColumns(rows, columns) {
  const lastValues = {};
  for (const col of columns) {
    lastValues[col] = '';
  }
  for (const row of rows) {
    for (const col of columns) {
      const current = String(row[col] ?? '').trim();
      if (current) {
        lastValues[col] = current;
      } else if (lastValues[col]) {
        row[col] = lastValues[col];
      }
    }
  }
}

function validateFileName(file, expectedName) {
  if (!file) return false;

  const actualName = String(file.name || '');
  const baseName = actualName.replace(/\.[^.]+$/, '');
  const matches = expectedName === 'PAYOUT_PREFIX'
    ? baseName.toLowerCase().startsWith('payout_')
    : actualName.toLowerCase() === expectedName.toLowerCase();

  if (!matches) {
    const expectedText = expectedName === 'PAYOUT_PREFIX' ? "a file starting with 'PAYOUT_'" : `'${expectedName}'`;
    alert(`Incorrect file. Please upload ${expectedText}.`);
    return false;
  }

  return true;
}

async function handleFileUpload(event, targetKey, cardId, filenameId) {
  const file = event.target.files[0];
  if (!file) return;

  const expectedName = targetKey === 'payment' ? 'PAYOUT_PREFIX' : 'email sheet.xlsx';
  if (!validateFileName(file, expectedName)) {
    event.target.value = '';
    return;
  }

  try {
    const data = await readFile(file);
    if (targetKey === 'payment') {
      paymentSheetData = data;
      payoutFileName = String(file.name || '').replace(/\.[^.]+$/, '');
    } else {
      emailSheetData = data;
    }

    const card = document.getElementById(cardId);
    const filename = document.getElementById(filenameId);
    card.classList.add('has-file');
    filename.textContent = `✓ ${file.name}`;
    filename.style.display = 'block';

    checkReady();
    hideError();
  } catch (err) {
    showError('Could not read file. Please upload a valid CSV/XLSX file.');
  }
}

document.getElementById('paymentSheetInput').addEventListener('change', (e) => {
  handleFileUpload(e, 'payment', 'paymentSheetCard', 'paymentSheetName');
});

document.getElementById('emailSheetInput').addEventListener('change', (e) => {
  handleFileUpload(e, 'email', 'emailSheetCard', 'emailSheetName');
});

['paymentSheetCard', 'emailSheetCard'].forEach((id) => {
  const el = document.getElementById(id);
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('dragover');
  });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const inputId = id === 'paymentSheetCard' ? 'paymentSheetInput' : 'emailSheetInput';
    const input = document.getElementById(inputId);
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
});

function checkReady() {
  document.getElementById('runBtn').disabled = !(paymentSheetData && emailSheetData);
}

function buildEmailRecords() {
  const rows = emailSheetData.slice(1).map((row) => [...row]);
  fillDownColumns(rows, [15, 16]);

  const grouped = new Map();
  const normalizeEmailList = (rawValue) => String(rawValue || '')
    .split(/[,:;\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  rows
    .map((row) => {
      const emailSheetClientName = String(row[0] || '').trim();
      const parentheticalMatch = emailSheetClientName.match(/\(([^)]+)\)/);
      const mainName = emailSheetClientName.replace(/\([^)]*\)/g, ' ').trim();
      const normalizedName = normalizeName(mainName || emailSheetClientName, true);
      const normalizedNameInParentheses = parentheticalMatch
        ? normalizeName(parentheticalMatch[1], true)
        : '';

      return {
        emailSheetClientName,
        normalizedName,
        normalizedNameInParentheses,
        agentEmail: String(row[2] || '')
        .split(/[,:;\s]+/)[0]
        .trim(),
        paymentReceivedDate: parseDateValue(row[5]),
        clientEmailRaw: String(row[15] || '').trim(),
        mobile: String(row[16] || '')
        .split(/[,:;\s]+/)[0]
        .replace(/[^\d+]/g, '')
        .trim(),
        multipleEmails: false
      };
    })
    .filter((record) => record.emailSheetClientName && (record.normalizedName || record.normalizedNameInParentheses))
    .forEach((record) => {
      const key = record.normalizedName;
      if (!key) return;

      if (!grouped.has(key)) {
        grouped.set(key, {
          ...record,
          _count: 1,
          _emailSet: new Set(normalizeEmailList(record.clientEmailRaw))
        });
        return;
      }

      const existing = grouped.get(key);
      const existingDate = parseNormalizedDateToUTC(existing.paymentReceivedDate);
      const currentDate = parseNormalizedDateToUTC(record.paymentReceivedDate);
      const useCurrent = currentDate && (!existingDate || currentDate > existingDate);
      normalizeEmailList(record.clientEmailRaw).forEach((email) => existing._emailSet.add(email));

      if (useCurrent) {
        grouped.set(key, {
          ...record,
          _count: existing._count + 1,
          _emailSet: existing._emailSet
        });
      } else {
        existing._count += 1;
      }
    });

  return Array.from(grouped.values()).map((record) => ({
    ...record,
    multipleEmails: record._emailSet.size > 1
  }));
}

function runMatcher() {
  hideError();

  if (!paymentSheetData || !emailSheetData) {
    showError('Please upload both required files.');
    return;
  }

  const emailRecords = buildEmailRecords();
  if (!emailRecords.length) {
    showError('Email Sheet has no usable rows.');
    return;
  }

  const paymentRows = paymentSheetData.slice(1).filter((row) => {
    const clientColValue = String(row[1] || '').trim();
    return clientColValue.toLowerCase() !== 'total';
  });
  const groupedPayments = groupPaymentRowsByClient(paymentRows);
  results = groupedPayments.map((group) => buildMatchResult(group, emailRecords));

  renderStats();
  renderTable();
}

function parseNormalizedDateToUTC(ddmmyyyy) {
  const match = String(ddmmyyyy || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  return new Date(Date.UTC(year, month - 1, day));
}

function groupPaymentRowsByClient(paymentRows) {
  const groups = new Map();

  for (const row of paymentRows) {
    const paymentClientName = String(row[1] || '').trim();
    if (!paymentClientName) continue;

    const normalizedPaymentName = normalizeName(paymentClientName, false);
    if (!normalizedPaymentName) continue;

    if (!groups.has(normalizedPaymentName)) {
      groups.set(normalizedPaymentName, {
        normalizedPaymentName,
        paymentClientName,
        units: Number(row[2]) || 0,
        agentClosing: String(row[12] || '').trim(),
        payoutNote: String(row[13] || '').trim()
      });
    }
  }

  return Array.from(groups.values());
}

function buildMatchResult(group, emailRecords) {
  const parentheticalMatch = group.paymentClientName.match(/\(([^)]+)\)/);
  const normalizedInnerName = parentheticalMatch
    ? normalizeName(parentheticalMatch[1], false)
    : '';
  const normalizedOuterName = normalizeName(group.paymentClientName.replace(/\([^)]*\)/g, ' ').trim(), false);
  const lookup = (normalized) => emailRecords.find((record) =>
    record.normalizedName === normalized || record.normalizedNameInParentheses === normalized
  );
  const matchedRecord = (normalizedInnerName && lookup(normalizedInnerName)) || lookup(normalizedOuterName) || null;
  const status = matchedRecord ? 'valid' : 'invalid';

  const [email1, email2] = splitEmails(matchedRecord ? matchedRecord.clientEmailRaw : '');
  const notes = [];
  const hasMultipleAgentsNote = group.payoutNote && /multiple agents/i.test(group.payoutNote);

  if (hasMultipleAgentsNote) {
    notes.push(group.payoutNote);
  } else {
    if (matchedRecord && matchedRecord.multipleEmails) notes.push('Multiple emails detected');
    if (!matchedRecord) notes.push('Name not found in email sheet');
    if (matchedRecord && !email1) notes.push('Email missing in email sheet');
    if (matchedRecord && !matchedRecord.agentEmail) notes.push('Agent email missing in email sheet');
    if (matchedRecord && !group.agentClosing) notes.push('Agent name missing');
  }

  return {
    paymentClientName: group.paymentClientName,
    emailSheetClientName: matchedRecord ? matchedRecord.emailSheetClientName : '',
    units: group.units,
    email1,
    email2,
    mobile: matchedRecord ? matchedRecord.mobile : '',
    agentClosing: group.agentClosing,
    agentEmail: matchedRecord ? matchedRecord.agentEmail : '',
    notes: notes.join(' | '),
    status
  };
}

function renderStats() {
  const total = results.length;
  const confirmed = results.filter((row) => row.status === 'valid').length;
  const mismatch = results.filter((row) => row.status === 'warn').length;
  const noMatch = results.filter((row) => row.status === 'invalid').length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statConfirmed').textContent = confirmed;
  document.getElementById('statMismatch').textContent = mismatch;
  document.getElementById('statNomatch').textContent = noMatch;
  document.getElementById('statsBar').classList.add('visible');
}

function renderTable() {
  const headers = [
    'Client Name (Payout Sheet)',
    'Client Name (Email Sheet)',
    'Email 1',
    'Mobile',
    'Agent Closing',
    'Agent Email',
    'Notes'
  ];

  document.getElementById('tableHead').innerHTML = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;

  const previewRows = results.slice(0, PREVIEW_LIMIT);
  document.getElementById('tableBody').innerHTML = previewRows
    .map((row) => {
      const notesCell = row.notes
        ? `<span class="badge ${statusToBadgeClass(row.status)}"><span class="badge-dot"></span>${esc(row.notes)}</span>`
        : '<span class="badge badge-valid"><span class="badge-dot"></span>Confirmed</span>';

      return `<tr>
        <td class="name-col">${esc(row.paymentClientName)}</td>
        <td class="name-col" style="font-weight:400;color:var(--text-muted)">${esc(row.emailSheetClientName || '—')}</td>
        <td class="mono">${esc(row.email1)}</td>
        <td class="mono">${esc(row.mobile)}</td>
        <td>${esc(row.agentClosing)}</td>
        <td class="mono">${esc(row.agentEmail)}</td>
        <td>${notesCell}</td>
      </tr>`;
    })
    .join('');

  const previewCount = document.getElementById('previewCount');
  const shown = Math.min(PREVIEW_LIMIT, results.length);
  previewCount.textContent = `Showing ${shown} of ${results.length} rows`;
  previewCount.classList.add('visible');

  document.getElementById('resultsBar').classList.add('visible');
  document.getElementById('tableWrap').classList.add('visible');
}

function statusToBadgeClass(status) {
  if (status === 'valid') return 'badge-valid';
  if (status === 'warn') return 'badge-warn';
  return 'badge-invalid';
}

function exportExcel() {
  if (!results.length) return;

  const exportRows = results.map((row) => ({
    'Client Name (Payout Sheet)': row.paymentClientName,
    'Client Name (Email Sheet)': row.emailSheetClientName,
    'Units': row.units,
    'Email 1': row.email1,
    'Email 2': row.email2,
    'Mobile': row.mobile,
    'Agent Closing': row.agentClosing,
    'Agent Email': row.agentEmail,
    'Notes': row.notes
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Email Matching Results');

  const exportBaseName = payoutFileName
    ? payoutFileName.replace(/^payout_/i, 'EMAIL_MATCH_')
    : 'EMAIL_MATCH_EXPORT';
  XLSX.writeFile(wb, `${exportBaseName}.xlsx`);
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showError(msg) {
  const banner = document.getElementById('errorBanner');
  banner.textContent = `⚠ ${msg}`;
  banner.classList.add('visible');
}

function hideError() {
  document.getElementById('errorBanner').classList.remove('visible');
}

fetch('/components/footer.html')
  .then((res) => res.text())
  .then((data) => {
    document.getElementById('footer').innerHTML = data;
  });
