// Deed of Novation Report — client-side only, no upload/export
// Excludes: Sabeerali Karuparamban (Contract Ended)

const EXCLUDED_CLIENTS = new Set(['Sabeerali Karuparamban']);

const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');
const errorMsg = document.getElementById('errorMsg');
const resultArea = document.getElementById('resultArea');

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

let lastReport = null; // holds computed report for copy button

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
  resultArea.style.display = 'none';
}

function clearError() {
  errorMsg.style.display = 'none';
}

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

      const report = buildReport(rows);
      lastReport = report;
      renderReport(report);
      resultArea.style.display = 'block';
    } catch (err) {
      showError('Could not read this file. Make sure it is a valid .xlsx export of the Non_Termination_List.');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function buildReport(rows) {
  // rows[0] = header row, skip it
  const clientOrder = [];       // preserves first-seen sheet order
  const clientMap = new Map();  // name -> { received:Set, rejected:Set, pending:Set }

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

    if (status === 'Received') g.received.add(identifier);
    else if (status === 'Rejected') g.rejected.add(identifier);
    else g.pending.add(identifier);
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

  return {
    totalReceived, totalRejected, totalPending, totalUniqueDeeds,
    activeRows, pendingRows
  };
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function exportReport() {
  if (!lastReport) return;
  const r = lastReport;

  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('Deed of Novation Report');

  ws.columns = [{ width: 42 }, { width: 16 }, { width: 14 }];

  ws.mergeCells('A1:C1');
  ws.getCell('A1').value = 'Deed of Novation Report';
  ws.getCell('A1').font = { name: 'Arial', size: 14, bold: true };

  ws.getCell('A3').value = 'Summary';
  ws.getCell('A3').font = { name: 'Arial', bold: true };

  const summaryRows = [
    ['Received', r.totalReceived],
    ['Rejected', r.totalRejected],
    ['Pending', r.totalPending],
    ['Total Unique Deeds', r.totalUniqueDeeds]
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
  text += `Total Unique Deeds: ${r.totalUniqueDeeds}\n\n`;

  text += 'Deeds Received / Rejected\n';
  text += '------------------------------\n';
  r.activeRows.forEach(row => {
    text += `${row.name} — ${row.x}/${row.y}${row.rejected ? ' (Rejected)' : ''}\n`;
  });

  text += '\nPending (0 Received)\n';
  text += '------------------------------\n';
  r.pendingRows.forEach(row => {
    text += `${row.name} — ${row.x}/${row.y}\n`;
  });

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
