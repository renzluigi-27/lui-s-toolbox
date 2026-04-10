let paymentSheetData = null;
let emailSheetData = null;
let results = [];

const NAME_PREFIXES = /^(mr\.?|mrs\.?|ms\.?)\s+/i;
const PREVIEW_LIMIT = 10;

(function initCycleSelectors() {
  const now = new Date();
  const yearSel = document.getElementById('selYear');
  for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    yearSel.appendChild(option);
  }
})();

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
  const matches = actualName.toLowerCase() === expectedName.toLowerCase();

  if (!matches) {
    alert(`Incorrect file. Please upload '${expectedName}'.`);
    return false;
  }

  return true;
}

async function handleFileUpload(event, targetKey, cardId, filenameId) {
  const file = event.target.files[0];
  if (!file) return;

  const expectedName = targetKey === 'payment' ? 'payment info sheet.xlsx' : 'email sheet.xlsx';
  if (!validateFileName(file, expectedName)) {
    event.target.value = '';
    return;
  }

  try {
    const data = await readFile(file);
    if (targetKey === 'payment') {
      paymentSheetData = data;
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

document.getElementById('selMonth').addEventListener('change', checkReady);
document.getElementById('selCycle').addEventListener('change', checkReady);
document.getElementById('selYear').addEventListener('change', checkReady);

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
  const cycleSelected = !!(
    document.getElementById('selMonth').value &&
    document.getElementById('selCycle').value &&
    document.getElementById('selYear').value
  );
  document.getElementById('runBtn').disabled = !(paymentSheetData && emailSheetData && cycleSelected);
}

function buildEmailRecords() {
  const rows = emailSheetData.slice(1).map((row) => [...row]);
  fillDownColumns(rows, [15, 16]);

  return rows
    .map((row) => {
      const emailSheetClientName = String(row[0] || '').trim();
      const normalizedName = normalizeName(emailSheetClientName, true);

      return {
        emailSheetClientName,
        normalizedName,
        agentEmail: String(row[2] || '')
        .split(/[,:;\s]+/)[0]
        .trim(),
        paymentReceivedDate: parseDateValue(row[5]),
        clientEmailRaw: String(row[15] || '').trim(),
        mobile: String(row[16] || '')
        .split(/[,:;\s]+/)[0]
        .replace(/[^\d+]/g, '')
        .trim()
      };
    })
    .filter((record) => record.emailSheetClientName && record.normalizedName);
}

function runMatcher() {
  hideError();

  if (!paymentSheetData || !emailSheetData) {
    showError('Please upload both required files.');
    return;
  }

  if (!document.getElementById('selMonth').value || !document.getElementById('selCycle').value || !document.getElementById('selYear').value) {
    showError('Please select payout cycle (month, cycle, and year).');
    return;
  }

  const emailRecords = buildEmailRecords();
  if (!emailRecords.length) {
    showError('Email Sheet has no usable rows.');
    return;
  }

  const paymentRows = filterPaymentRowsByCycle(paymentSheetData.slice(1));
  const groupedPayments = groupPaymentRowsByClient(paymentRows);
  results = groupedPayments.map((group) => buildMatchResult(group, emailRecords));

  renderStats();
  renderTable();
}

function filterPaymentRowsByCycle(paymentRows) {
  const yr = parseInt(document.getElementById('selYear').value, 10);
  const mo = parseInt(document.getElementById('selMonth').value, 10);
  const cycle = document.getElementById('selCycle').value;
  const payoutDay = cycle === '15' ? 15 : new Date(yr, mo, 0).getDate();
  const payoutDate = new Date(Date.UTC(yr, mo - 1, payoutDay));

return paymentRows.filter((row) => {

    const amValue = String(row[38] || '').toLowerCase();

    if (
        amValue.includes("yes") ||
        amValue.includes("contract closed") ||
        amValue.includes("duplicate entry")
    ) {
        return false; // skip row
    }

    const clientName = String(row[1] || '').trim();
    if (!clientName) return false;

    const firstPayoutDate = parseDateValue(row[23]);
    if (!firstPayoutDate) return false;

    const firstPayoutDt = parseNormalizedDateToUTC(firstPayoutDate);
    if (!firstPayoutDt) return false;

    const cycleMatch = cycle === '15'
      ? firstPayoutDt.getUTCDate() === 15
      : (firstPayoutDt.getUTCDate() === 30 || firstPayoutDt.getUTCDate() === 31);

    const alreadyStarted = firstPayoutDt <= payoutDate;
    return cycleMatch && alreadyStarted;
  });
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
        units: 0,
        paymentDates: new Set(),
        agentClosing: String(row[37] || '').trim()
      });
    }

    const group = groups.get(normalizedPaymentName);
    group.units += 1;

    const paymentDate = parseDateValue(row[18]);
    if (paymentDate) group.paymentDates.add(paymentDate);
  }

  return Array.from(groups.values());
}

function buildMatchResult(group, emailRecords) {
  const byName = emailRecords.filter((record) => record.normalizedName === group.normalizedPaymentName);
  let matchedRecord = null;
  let notes = 'No match found';
  let status = 'invalid';

  if (byName.length > 0) {
    const byNameAndDate = byName.filter((record) => {
  return Array.from(group.paymentDates).some((paymentDate) => {
    const p = parseNormalizedDateToUTC(paymentDate);
    const e = parseNormalizedDateToUTC(record.paymentReceivedDate);
    return p && e && p.getUTCMonth() === e.getUTCMonth() && p.getUTCFullYear() === e.getUTCFullYear();
  });
});
    matchedRecord = byNameAndDate[0] || byName[0];

    if (byNameAndDate.length > 0) {
      notes = '';
      status = 'valid';
    } else {
      notes = 'Date mismatch — verify';
      status = 'warn';
    }
  }

  const [email1, email2] = splitEmails(matchedRecord ? matchedRecord.clientEmailRaw : '');

  return {
    paymentClientName: group.paymentClientName,
    emailSheetClientName: matchedRecord ? matchedRecord.emailSheetClientName : '',
    units: group.units,
    email1,
    email2,
    mobile: matchedRecord ? matchedRecord.mobile : '',
    agentClosing: group.agentClosing,
    agentEmail: matchedRecord ? matchedRecord.agentEmail : '',
    notes,
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
    'Client Name (Payment Sheet)',
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
    'Client Name (Payment Sheet)': row.paymentClientName,
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

  const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const cycle = document.getElementById('selCycle').value === '15' ? '15' : '30_31';
  const month = monthNames[parseInt(document.getElementById('selMonth').value, 10) - 1] || 'MONTH';
  const year = document.getElementById('selYear').value || 'YEAR';
  XLSX.writeFile(wb, `EMAIL_MATCH_${cycle}_${month}${year}.xlsx`);
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
