// Deed of Novation Report — client-side only
// Excludes: Sabeerali Karuparamban (Contract Ended)

const EXCLUDED_CLIENTS = new Set(['Sabeerali Karuparamban']);

const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');
const errorMsg = document.getElementById('errorMsg');
const resultArea = document.getElementById('resultArea');

const prevUploadZone = document.getElementById('prevUploadZone');
const prevFileInput = document.getElementById('prevFileInput');
const prevFileNameEl = document.getElementById('prevFileName');
const prevErrorMsg = document.getElementById('prevErrorMsg');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

prevUploadZone.addEventListener('click', () => prevFileInput.click());
prevUploadZone.addEventListener('dragover', (e) => { e.preventDefault(); prevUploadZone.classList.add('dragover'); });
prevUploadZone.addEventListener('dragleave', () => prevUploadZone.classList.remove('dragover'));
prevUploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  prevUploadZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handlePrevFile(e.dataTransfer.files[0]);
});
prevFileInput.addEventListener('change', (e) => {
  if (e.target.files.length) handlePrevFile(e.target.files[0]);
});

let lastReport = null;          // holds computed report for copy/export buttons
let lastIdentifierMap = null;   // Map identifier -> { clientName, status } for current upload
let previousIdentifierMap = null; // Map identifier -> { clientName, status } from previous exported report
let previousGeneratedAt = null; // string label of when the previous report was generated

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
  resultArea.style.display = 'none';
}
function clearError() { errorMsg.style.display = 'none'; }

function showPrevError(msg) {
  prevErrorMsg.textContent = msg;
  prevErrorMsg.style.display = 'block';
}
function clearPrevError() { prevErrorMsg.style.display = 'none'; }

function handleFile(file) {
  clearError();
  fileNameEl.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      if (!workbook.Sheets['Final List']) {
        showError('Sheet "Final List" not found in this file. Please upload the correct Non_Termination_List file.');
        return;
      }

      const ws = workbook.Sheets['Final List'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

      const { report, identifierMap } = buildReport(rows);
      lastReport = report;
      lastIdentifierMap = identifierMap;
      renderReport(report);
      resultArea.style.display = 'block';
      maybeRenderDiff();
    } catch (err) {
      showError('Could not read this file. Make sure it is a valid .xlsx export of the Non_Termination_List.');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function handlePrevFile(file) {
  clearPrevError();
  prevFileNameEl.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      if (!workbook.Sheets['RawData']) {
        showPrevError('This file has no "RawData" sheet — please upload a report that was exported from this tool.');
        previousIdentifierMap = null;
        maybeRenderDiff();
        return;
      }

      const ws = workbook.Sheets['RawData'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

      const map = new Map();
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[1]) continue;
        map.set(String(row[1]), { clientName: String(row[0] || ''), status: String(row[2] || '') });
      }
      previousIdentifierMap = map;

      // pull generated-at label if present in Summary sheet
      previousGeneratedAt = null;
      if (workbook.Sheets['Deed of Novation Report']) {
        const summaryWs = workbook.Sheets['Deed of Novation Report'];
        const summaryRows = XLSX.utils.sheet_to_json(summaryWs, { header: 1, defval: null, raw: false });
        for (const r of summaryRows) {
          if (r && r[0] === 'Generated At') { previousGeneratedAt = r[1]; break; }
        }
      }

      maybeRenderDiff();
    } catch (err) {
      showPrevError('Could not read this file.');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function buildReport(rows) {
  // rows[0] = header row, skip it
  const clientOrder = [];       // preserves first-seen sheet order
  const clientMap = new Map();  // name -> { received:Set, rejected:Set, pending:Set }
  const identifierMap = new Map(); // identifier -> { clientName, status }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const contractNoRaw = row[0];
    const clientNameRaw = row[1];
    const containerNoRaw = row[2];
    const statusRaw = row[7];

    if (!clientNameRaw) continue;
    const clientName = String(clientNameRaw).trim();
    if (!clientName) continue;
    if (EXCLUDED_CLIENTS.has(clientName)) continue;

    const status = statusRaw ? String(statusRaw).trim() : '';
    const contractNo = contractNoRaw ? String(contractNoRaw).trim() : '';
    const containerNo = containerNoRaw ? String(containerNoRaw).trim() : '';

    // Skip Contract Ended entirely (out of scope for this report)
    if (status === 'Contract Ended') continue;

    // Identifier: real contract no, or grouped-per-client when "No Number"
    const identifier = (contractNo === 'No Number')
      ? `NN|${clientName}`
      : `CN|${contractNo || containerNo}`;

    if (!clientMap.has(clientName)) {
      clientMap.set(clientName, { received: new Set(), rejected: new Set(), pending: new Set() });
      clientOrder.push(clientName);
    }
    const g = clientMap.get(clientName);
    const effectiveStatus = status || 'Pending';

    if (status === 'Received') g.received.add(identifier);
    else if (status === 'Rejected') g.rejected.add(identifier);
    else g.pending.add(identifier);

    identifierMap.set(identifier, { clientName, status: effectiveStatus });
  }

  let totalReceived = 0, totalRejected = 0, totalPending = 0;
  const activeRows = [];
  const pendingRows = [];

  for (const name of clientOrder) {
    const g = clientMap.get(name);
    const totalUnique = new Set([...g.received, ...g.rejected, ...g.pending]);
    const x = g.received.size;
    const y = totalUnique.size;
    const isRejected = g.rejected.size > 0;

    totalReceived += g.received.size;
    totalRejected += g.rejected.size;
    totalPending += g.pending.size;

    if (x === 0 && !isRejected) {
      pendingRows.push({ name, x, y });
    } else {
      activeRows.push({ name, x, y, rejected: isRejected });
    }
  }

  const totalUniqueDeeds = totalReceived + totalRejected + totalPending;

  const report = {
    totalReceived, totalRejected, totalPending, totalUniqueDeeds,
    activeRows, pendingRows
  };

  return { report, identifierMap };
}

function renderReport(report) {
  const summaryGrid = document.getElementById('summaryGrid');
  summaryGrid.innerHTML = `
    <div class="stat-box"><div class="num">${report.totalReceived}</div><div class="label">Received</div></div>
    <div class="stat-box"><div class="num">${report.totalRejected}</div><div class="label">Rejected</div></div>
    <div class="stat-box"><div class="num">${report.totalPending}</div><div class="label">Pending</div></div>
    <div class="stat-box total"><div class="num">${report.totalUniqueDeeds}</div><div class="label">Total Unique</div></div>
  `;

  const activeBody = document.getElementById('activeTableBody');
  activeBody.innerHTML = report.activeRows.map(r => `
    <tr class="${r.rejected ? 'rejected-row' : ''}">
      <td>${escapeHtml(r.name)}</td>
      <td>${r.x}/${r.y}</td>
      <td>${r.rejected ? '<span class="badge-rej">Rejected</span>' : ''}</td>
    </tr>
  `).join('');

  const pendingBody = document.getElementById('pendingTableBody');
  pendingBody.innerHTML = report.pendingRows.map(r => `
    <tr><td>${escapeHtml(r.name)}</td><td>${r.x}/${r.y}</td></tr>
  `).join('');
}

function maybeRenderDiff() {
  const card = document.getElementById('newSinceCard');
  if (!lastIdentifierMap || !previousIdentifierMap) {
    card.style.display = 'none';
    return;
  }

  // per-client change tallies
  const changes = new Map(); // clientName -> { newlyReceived, newlyRejected, newEntries }

  for (const [identifier, cur] of lastIdentifierMap) {
    const old = previousIdentifierMap.get(identifier);
    let changeType = null;

    if (!old) {
      changeType = 'new_entry';
    } else if (old.status !== cur.status) {
      if (cur.status === 'Received') changeType = 'newly_received';
      else if (cur.status === 'Rejected') changeType = 'newly_rejected';
      else changeType = 'status_changed';
    }

    if (!changeType) continue;

    if (!changes.has(cur.clientName)) {
      changes.set(cur.clientName, { newlyReceived: 0, newlyRejected: 0, newEntries: 0, statusChanged: 0 });
    }
    const c = changes.get(cur.clientName);
    if (changeType === 'newly_received') c.newlyReceived++;
    else if (changeType === 'newly_rejected') c.newlyRejected++;
    else if (changeType === 'new_entry') c.newEntries++;
    else if (changeType === 'status_changed') c.statusChanged++;
  }

  const body = document.getElementById('newSinceTableBody');
  const emptyMsg = document.getElementById('newSinceEmpty');
  const dateLabel = document.getElementById('prevDateLabel');
  dateLabel.textContent = previousGeneratedAt ? `(vs ${previousGeneratedAt})` : '';

  if (changes.size === 0) {
    body.innerHTML = '';
    emptyMsg.style.display = 'block';
  } else {
    emptyMsg.style.display = 'none';
    const rowsHtml = [];
    for (const [name, c] of changes) {
      const parts = [];
      if (c.newlyReceived) parts.push(`+${c.newlyReceived} Received`);
      if (c.newlyRejected) parts.push(`+${c.newlyRejected} Rejected`);
      if (c.newEntries) parts.push(`+${c.newEntries} New Entry`);
      if (c.statusChanged) parts.push(`${c.statusChanged} Status Changed`);
      rowsHtml.push(`<tr><td>${escapeHtml(name)}</td><td>${parts.join(', ')}</td></tr>`);
    }
    body.innerHTML = rowsHtml.join('');
  }

  card.style.display = 'block';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function exportReport() {
  if (!lastReport || !lastIdentifierMap) return;
  const r = lastReport;

  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('Deed of Novation Report');

  ws.columns = [{ width: 42 }, { width: 16 }, { width: 14 }];

  ws.mergeCells('A1:C1');
  ws.getCell('A1').value = 'Deed of Novation Report';
  ws.getCell('A1').font = { name: 'Arial', size: 14, bold: true };

  ws.getCell('A3').value = 'Summary';
  ws.getCell('A3').font = { name: 'Arial', bold: true };

  const generatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const summaryRows = [
    ['Received', r.totalReceived],
    ['Rejected', r.totalRejected],
    ['Pending', r.totalPending],
    ['Total Unique Deeds', r.totalUniqueDeeds],
    ['Generated At', generatedAt]
  ];
  let row = 4;
  summaryRows.forEach(([label, val]) => {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { name: 'Arial' };
    ws.getCell(`B${row}`).value = val;
    ws.getCell(`B${row}`).font = { name: 'Arial' };
    row++;
  });

  row += 1;
  ws.getCell(`A${row}`).value = 'Deeds Received / Rejected';
  ws.getCell(`A${row}`).font = { name: 'Arial', bold: true };
  row++;

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
  ['Client Name', 'Deed Count', 'Status'].forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { name: 'Arial', bold: true };
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center' };
  });
  row++;

  r.activeRows.forEach(item => {
    ws.getCell(`A${row}`).value = item.name;
    ws.getCell(`A${row}`).font = { name: 'Arial' };
    ws.getCell(`B${row}`).value = `${item.x}/${item.y}`;
    ws.getCell(`B${row}`).font = { name: 'Arial' };
    ws.getCell(`B${row}`).alignment = { horizontal: 'center' };
    ws.getCell(`C${row}`).value = item.rejected ? 'Rejected' : '';
    ws.getCell(`C${row}`).font = { name: 'Arial' };
    row++;
  });

  row += 1;
  ws.getCell(`A${row}`).value = 'Pending (0 Received)';
  ws.getCell(`A${row}`).font = { name: 'Arial', bold: true };
  row++;

  ['Client Name', 'Deed Count'].forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { name: 'Arial', bold: true };
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center' };
  });
  row++;

  r.pendingRows.forEach(item => {
    ws.getCell(`A${row}`).value = item.name;
    ws.getCell(`A${row}`).font = { name: 'Arial' };
    ws.getCell(`B${row}`).value = `${item.x}/${item.y}`;
    ws.getCell(`B${row}`).font = { name: 'Arial' };
    ws.getCell(`B${row}`).alignment = { horizontal: 'center' };
    row++;
  });

  // ── RawData sheet — machine-readable snapshot for next-day comparison ──
  const rawWs = wb.addWorksheet('RawData');
  rawWs.columns = [{ width: 42 }, { width: 30 }, { width: 14 }];
  ['Client Name', 'Identifier', 'Status'].forEach((h, i) => {
    const cell = rawWs.getCell(1, i + 1);
    cell.value = h;
    cell.font = { name: 'Arial', bold: true };
  });
  let rawRow = 2;
  for (const [identifier, info] of lastIdentifierMap) {
    rawWs.getCell(`A${rawRow}`).value = info.clientName;
    rawWs.getCell(`B${rawRow}`).value = identifier;
    rawWs.getCell(`C${rawRow}`).value = info.status;
    rawRow++;
  }

  wb.xlsx.writeBuffer().then(buffer => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Deed_of_Novation_Report.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

function copyReport() {
  if (!lastReport) return;
  const r = lastReport;
  let text = 'Deed of Novation Report\n';
  text += '------------------------------\n';
  text += `Received: ${r.totalReceived}\n`;
  text += `Rejected: ${r.totalRejected}\n`;
  text += `Pending: ${r.totalPending}\n`;
  text += `Total Unique Deeds: ${r.totalUniqueDeeds}\n`;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyBtn');
    const label = document.getElementById('copyLabel');
    btn.classList.add('copied');
    label.textContent = 'Copied!';
    setTimeout(() => {
      btn.classList.remove('copied');
      label.textContent = 'Copy Report';
    }, 1600);
  });
}
