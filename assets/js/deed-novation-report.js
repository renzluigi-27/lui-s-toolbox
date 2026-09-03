// Deed of Novation Report — client-side only
// Excludes: Sabeerali Karuparamban, and any "Contract Ended" status entirely
// Identifier rule: Contract No. when present; when "No Number", grouped by
// Client Name + Agreement Start Date (multiple containers, same date = 1 deed).

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

let lastReport = null;            // computed report (groups + totals)
let lastIdentifierMap = null;     // Map identifier -> { clientName, status } for current upload
let previousIdentifierMap = null; // Map identifier -> { clientName, status } from previous exported report
let previousGeneratedAt = null;   // label of when the previous report was generated
let changesMap = null;            // Map clientName -> change tally (only when previous report loaded)

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
      changesMap = previousIdentifierMap ? computeChanges(identifierMap, previousIdentifierMap) : null;
      renderReport(report, changesMap);
      resultArea.style.display = 'block';
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
        if (lastReport) { changesMap = null; renderReport(lastReport, null); }
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

      previousGeneratedAt = null;
      if (workbook.Sheets['Summary']) {
        const summaryWs = workbook.Sheets['Summary'];
        const summaryRows = XLSX.utils.sheet_to_json(summaryWs, { header: 1, defval: null, raw: false });
        for (const r of summaryRows) {
          if (r && r[0] === 'Generated At') { previousGeneratedAt = r[1]; break; }
        }
      }

      if (lastReport && lastIdentifierMap) {
        changesMap = computeChanges(lastIdentifierMap, previousIdentifierMap);
        renderReport(lastReport, changesMap);
      }
    } catch (err) {
      showPrevError('Could not read this file.');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── Core report builder ──────────────────────────────────────────────
function buildReport(rows) {
  const clientOrder = [];        // preserves first-seen sheet order
  const clientMap = new Map();   // name -> { received:Set, rejected:Set, pending:Set, rejectedContainers:Set }
  const identifierMap = new Map(); // identifier -> { clientName, status }
  const categoryMap = new Map(); // clientName -> Client Category (column J), first value seen
  const emailMap = new Map();    // clientName -> Email Address (column G), first non-blank seen
  let totalReceivedContainers = 0; // raw row count with status="Received" (no dedup) — Copy Report only

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const contractNoRaw = row[0];
    const clientNameRaw = row[1];
    const containerNoRaw = row[2];
    const agreementDateRaw = row[3];
    const emailRaw = row[6];
    const statusRaw = row[7];
    const categoryRaw = row[9];

    if (!clientNameRaw) continue;
    const clientName = String(clientNameRaw).trim();
    if (!clientName) continue;
    if (EXCLUDED_CLIENTS.has(clientName)) continue;

    const status = statusRaw ? String(statusRaw).trim() : '';
    const contractNo = contractNoRaw ? String(contractNoRaw).trim() : '';
    const containerNo = containerNoRaw ? String(containerNoRaw).trim() : '';

    if (status === 'Contract Ended') continue;

    if (!categoryMap.has(clientName)) {
      categoryMap.set(clientName, categoryRaw ? String(categoryRaw).trim() : 'Uncategorized');
    }
    const emailVal = emailRaw ? String(emailRaw).trim() : '';
    if (emailVal && !emailMap.get(clientName)) {
      emailMap.set(clientName, emailVal);
    }

    if (status === 'Received') totalReceivedContainers++;

    let identifier;
    if (contractNo === 'No Number') {
      const dateKey = normalizeDate(agreementDateRaw);
      identifier = `NN|${clientName}|${dateKey}`;
    } else {
      identifier = `CN|${contractNo || containerNo}`;
    }

    if (!clientMap.has(clientName)) {
      clientMap.set(clientName, { received: new Set(), rejected: new Set(), pending: new Set(), legal: new Set(), rejectedContainers: new Set(), legalContainers: new Set() });
      clientOrder.push(clientName);
    }
    const g = clientMap.get(clientName);
    const isLegal = status.toLowerCase() === 'legal';
    const effectiveStatus = status || 'Pending';

    if (status === 'Received') {
      g.received.add(identifier);
    } else if (status === 'Rejected') {
      g.rejected.add(identifier);
      if (containerNo) g.rejectedContainers.add(containerNo);
    } else if (isLegal) {
      g.legal.add(identifier);
      if (containerNo) g.legalContainers.add(containerNo);
    } else {
      g.pending.add(identifier);
    }

    identifierMap.set(identifier, { clientName, status: effectiveStatus });
  }

  let totalReceived = 0, totalRejectedDeeds = 0, totalPending = 0, totalLegalDeeds = 0;
  const completed = [];
  const pending = [];
  const rejected = [];
  const legal = [];

  for (const name of clientOrder) {
    const g = clientMap.get(name);
    const totalUnique = new Set([...g.received, ...g.rejected, ...g.pending, ...g.legal]);
    const x = g.received.size;
    const y = totalUnique.size;

    totalReceived += g.received.size;
    totalRejectedDeeds += g.rejected.size;
    totalPending += g.pending.size;
    totalLegalDeeds += g.legal.size;

    if (g.rejected.size > 0) {
      rejected.push({ name, containerCount: g.rejectedContainers.size });
    } else if (g.legal.size > 0) {
      legal.push({ name, containerCount: g.legalContainers.size });
    } else if (x === y && y > 0) {
      completed.push({ name, x, y });
    } else {
      pending.push({ name, x, y });
    }
  }

  // Rejected/Legal are tracked by CLIENT (a client with even one rejected/legal
  // deed moves entirely into that group) — so their displayed counts are
  // client counts, not deed/container counts. Total Deeds still sums actual
  // unique deeds across every status.
  const totalRejected = rejected.length;
  const totalLegal = legal.length;
  const totalDeeds = totalReceived + totalRejectedDeeds + totalPending + totalLegalDeeds;

  const report = {
    totalReceived, totalRejected, totalPending, totalLegal, totalDeeds, totalReceivedContainers,
    completed, pending, rejected, legal, categoryMap, emailMap
  };

  return { report, identifierMap };
}

function normalizeDate(raw) {
  if (!raw) return '';
  // raw comes through SheetJS as a formatted string (raw:false), keep as-is
  return String(raw).trim();
}

// ── Diff against previous report ─────────────────────────────────────
function computeChanges(currentMap, previousMap) {
  const changes = new Map(); // clientName -> { newlyReceived, newlyRejected, newEntries, statusChanged }

  for (const [identifier, cur] of currentMap) {
    const old = previousMap.get(identifier);
    let changeType = null;

    if (!old) {
      changeType = 'new_entry';
    } else if (old.status !== cur.status) {
      if (cur.status === 'Received') changeType = 'newly_received';
      else if (cur.status === 'Rejected') changeType = 'newly_rejected';
      else if (cur.status.toLowerCase() === 'legal') changeType = 'newly_legal';
      else changeType = 'status_changed';
    }

    if (!changeType) continue;

    if (!changes.has(cur.clientName)) {
      changes.set(cur.clientName, { newlyReceived: 0, newlyRejected: 0, newlyLegal: 0, newEntries: 0, statusChanged: 0 });
    }
    const c = changes.get(cur.clientName);
    if (changeType === 'newly_received') c.newlyReceived++;
    else if (changeType === 'newly_rejected') c.newlyRejected++;
    else if (changeType === 'newly_legal') c.newlyLegal++;
    else if (changeType === 'new_entry') c.newEntries++;
    else if (changeType === 'status_changed') c.statusChanged++;
  }

  return changes;
}

function changeText(c) {
  const parts = [];
  if (c.newlyReceived) parts.push(`+${c.newlyReceived} Received`);
  if (c.newlyRejected) parts.push(`+${c.newlyRejected} Rejected`);
  if (c.newlyLegal) parts.push(`+${c.newlyLegal} Legal`);
  if (c.newEntries) parts.push(`+${c.newEntries} New Entry`);
  if (c.statusChanged) parts.push(`${c.statusChanged} Status Changed`);
  return parts.join(', ');
}

// ── Rendering ─────────────────────────────────────────────────────────
function renderReport(report, changes) {
  const summaryGrid = document.getElementById('summaryGrid');
  summaryGrid.innerHTML = `
    <div class="stat-box"><div class="num">${report.totalReceived}</div><div class="label">Received</div></div>
    <div class="stat-box"><div class="num">${report.totalPending}</div><div class="label">Pending</div></div>
    <div class="stat-box"><div class="num">${report.totalRejected}</div><div class="label">Rejected</div></div>
    <div class="stat-box"><div class="num">${report.totalLegal}</div><div class="label">Legal</div></div>
    <div class="stat-box total"><div class="num">${report.totalDeeds}</div><div class="label">Total Deeds</div></div>
  `;

  const newCard = document.getElementById('newCard');
  const newBody = document.getElementById('newTableBody');
  const dateLabel = document.getElementById('prevDateLabel');

  if (changes && changes.size > 0) {
    dateLabel.textContent = previousGeneratedAt ? `(vs ${previousGeneratedAt})` : '';
    const rowsHtml = [];
    // order aligned with sheet order across completed+pending+rejected+legal
    const allNames = [
      ...report.completed.map(r => r.name),
      ...report.pending.map(r => r.name),
      ...report.rejected.map(r => r.name),
      ...report.legal.map(r => r.name)
    ];
    const seen = new Set();
    for (const name of allNames) {
      if (seen.has(name)) continue;
      seen.add(name);
      if (!changes.has(name)) continue;
      const statusLabel = statusLabelFor(report, name);
      rowsHtml.push(`<tr><td>${escapeHtml(name)}</td><td>${changeText(changes.get(name))}</td><td>${statusBadge(statusLabel)}</td></tr>`);
    }
    newBody.innerHTML = rowsHtml.join('');
    newCard.style.display = 'block';
  } else {
    newCard.style.display = 'none';
    newBody.innerHTML = '';
  }

  renderGroupTable('completedTableBody', 'completedEmpty', report.completed, changes, (r) => `<td>${r.x}/${r.y}</td>`);
  renderGroupTable('pendingTableBody', 'pendingEmpty', report.pending, changes, (r) => `<td>${r.x}/${r.y}</td>`);
  renderGroupTable('rejectedTableBody', 'rejectedEmpty', report.rejected, changes, (r) => `<td>${r.containerCount}</td>`);
  renderGroupTable('legalTableBody', 'legalEmpty', report.legal, changes, (r) => `<td>${r.containerCount}</td>`);
}

function statusLabelFor(report, name) {
  if (report.rejected.some(r => r.name === name)) return 'rejected';
  if (report.legal.some(r => r.name === name)) return 'legal';
  if (report.completed.some(r => r.name === name)) return 'completed';
  return 'pending';
}

function statusBadge(label) {
  if (label === 'completed') return '<span class="badge badge-completed">Completed</span>';
  if (label === 'rejected') return '<span class="badge badge-rejected">Rejected</span>';
  if (label === 'legal') return '<span class="badge badge-legal">Legal</span>';
  return '<span class="badge badge-pending">Pending</span>';
}

function renderGroupTable(bodyId, emptyId, list, changes, valueCellFn) {
  const body = document.getElementById(bodyId);
  const empty = document.getElementById(emptyId);

  if (list.length === 0) {
    body.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  // changed-first, preserving relative order within each partition
  const changedRows = [];
  const unchangedRows = [];
  for (const r of list) {
    if (changes && changes.has(r.name)) changedRows.push(r);
    else unchangedRows.push(r);
  }
  const ordered = [...changedRows, ...unchangedRows];

  body.innerHTML = ordered.map(r => `
    <tr>
      <td>${escapeHtml(r.name)}</td>
      ${valueCellFn(r)}
    </tr>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Copy (summary only) ─────────────────────────────────────────────
function copyReport() {
  if (!lastReport) return;
  const r = lastReport;
  let text = 'Deed of Novation Report\n';
  text += '------------------------------\n';
  text += `Received (per contract/client): ${r.totalReceived}\n`;
  text += `Rejected (per client): ${r.totalRejected}\n`;
  text += `Legal (per client): ${r.totalLegal}\n`;
  text += `Container Count: ${r.totalReceivedContainers}\n`;

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

function timestampTag() {
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = MONTHS[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}${mmm}${yyyy}_${hh}${min}${ss}`;
}

// ── Export to Excel ──────────────────────────────────────────────────
function exportExcel() {
  if (!lastReport || !lastIdentifierMap) return;
  const r = lastReport;

  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('Summary');

  ws.columns = [{ width: 42 }, { width: 16 }, { width: 14 }];

  ws.mergeCells('A1:C1');
  ws.getCell('A1').value = 'Deed of Novation Report';
  ws.getCell('A1').font = { name: 'Arial', size: 14, bold: true };

  const generatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const summaryRows = [
    ['Received', r.totalReceived],
    ['Pending', r.totalPending],
    ['Rejected', r.totalRejected],
    ['Legal', r.totalLegal],
    ['Total Deeds', r.totalDeeds],
    ['Generated At', generatedAt]
  ];
  let row = 3;
  summaryRows.forEach(([label, val]) => {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { name: 'Arial' };
    ws.getCell(`B${row}`).value = val;
    ws.getCell(`B${row}`).font = { name: 'Arial' };
    row++;
  });

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

  function writeGroup(title, list, valueLabel, valueFn) {
    row += 1;
    ws.getCell(`A${row}`).value = title;
    ws.getCell(`A${row}`).font = { name: 'Arial', bold: true };
    row++;
    ['Client Name', valueLabel].forEach((h, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = h;
      cell.font = { name: 'Arial', bold: true };
      cell.fill = headerFill;
      cell.alignment = { horizontal: 'center' };
    });
    row++;
    list.forEach(item => {
      ws.getCell(`A${row}`).value = item.name;
      ws.getCell(`A${row}`).font = { name: 'Arial' };
      ws.getCell(`B${row}`).value = valueFn(item);
      ws.getCell(`B${row}`).font = { name: 'Arial' };
      ws.getCell(`B${row}`).alignment = { horizontal: 'center' };
      row++;
    });
  }

  writeGroup('Completed', r.completed, 'Deed Count', (item) => `${item.x}/${item.y}`);
  writeGroup('Pending', r.pending, 'Deed Count', (item) => `${item.x}/${item.y}`);
  writeGroup('Rejected', r.rejected, 'Container Count', (item) => item.containerCount);
  writeGroup('Legal', r.legal, 'Container Count', (item) => item.containerCount);

  // ── RawData sheet — machine-readable snapshot for next-day comparison ──
  const rawWs = wb.addWorksheet('RawData');
  rawWs.columns = [{ width: 42 }, { width: 34 }, { width: 14 }];
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
    a.download = `Deed_of_Novation_Report_${timestampTag()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ── PDF export modal ─────────────────────────────────────────────────
let pendingExportFormat = 'pdf'; // 'pdf' or 'xlsx' — set by whichever export button opened the modal

function openPdfModal(format) {
  if (!lastReport) return;
  pendingExportFormat = format || 'pdf';
  document.getElementById('pdfModalTitle').textContent = pendingExportFormat === 'xlsx' ? 'Export to .XLSX' : 'Export to PDF';
  document.getElementById('pdfOverlay').classList.add('show');
}
function closePdfModal() {
  document.getElementById('pdfOverlay').classList.remove('show');
}

function handleReportExport(mode) {
  if (pendingExportFormat === 'xlsx') exportReportExcel(mode);
  else exportPdf(mode);
}

function openCategoryModal() {
  if (!lastReport) return;
  closePdfModal();

  const categoryOrder = [];
  const seen = new Set();
  for (const cat of lastReport.categoryMap.values()) {
    if (!seen.has(cat)) { seen.add(cat); categoryOrder.push(cat); }
  }

  const container = document.getElementById('categoryModalOptions');
  let html = categoryOrder.map(cat => `
    <div class="modal-btn" onclick='openStatusModal(${JSON.stringify(cat)})'>
      <div class="label">${escapeHtml(cat)}</div>
    </div>
  `).join('');
  html += `
    <div class="modal-btn" onclick="openStatusModal('all')">
      <div class="label">All</div>
      <div class="hint">Both agents</div>
    </div>
  `;
  container.innerHTML = html;
  document.getElementById('categoryOverlay').classList.add('show');
}
function closeCategoryModal() {
  document.getElementById('categoryOverlay').classList.remove('show');
}

let pendingCategoryAgent = null;

function openStatusModal(agent) {
  closeCategoryModal();
  pendingCategoryAgent = agent;
  const subtitle = document.getElementById('statusModalSubtitle');
  subtitle.textContent = agent === 'all' ? 'Choose status \u2014 All agents' : `Choose status \u2014 ${agent}`;

  const statuses = [
    ['complete', 'Completed', 'x/y match'],
    ['partial', 'Partial', 'Some received'],
    ['zero', 'Zero', '0 received'],
    ['rejected', 'Rejected', ''],
    ['legal', 'Legal', '']
  ];
  const container = document.getElementById('statusModalOptions');
  container.innerHTML = statuses.map(([val, label, hint]) => `
    <div class="modal-btn" onclick="handleCategoryExport('${val}')">
      <div class="label">${label}</div>
      ${hint ? `<div class="hint">${hint}</div>` : ''}
    </div>
  `).join('');
  document.getElementById('statusOverlay').classList.add('show');
}
function closeStatusModal() {
  document.getElementById('statusOverlay').classList.remove('show');
}

function handleCategoryExport(status) {
  if (pendingExportFormat === 'xlsx') exportCategoryDetailExcel(status);
  else exportCategoryDetailPdf(status);
}

async function exportPdf(mode) {
  closePdfModal();
  if (!lastReport) return;
  const r = lastReport;

  const GREEN = PDFLib.rgb(0x2E/255, 0x7D/255, 0x32/255);
  const AMBER = PDFLib.rgb(0xB9/255, 0x8A/255, 0x2E/255);
  const RED = PDFLib.rgb(0xB0/255, 0x3A/255, 0x2E/255);
  const BLUE = PDFLib.rgb(0x5B/255, 0x9B/255, 0xD5/255);
  const NAVY = PDFLib.rgb(0x1B/255, 0x4B/255, 0x7A/255);
  const LIGHT_ROW = PDFLib.rgb(0xEA/255, 0xF1/255, 0xF8/255);
  const WHITE = PDFLib.rgb(1, 1, 1);
  const GRAY_TXT = PDFLib.rgb(0x55/255, 0x55/255, 0x55/255);
  const DARK_TXT = PDFLib.rgb(0.15, 0.15, 0.15);

  const LETTERHEAD_URL = '/assets/lgmu_letterhead.pdf';

  async function fetchBytes(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }

  const pdfDoc = await PDFLib.PDFDocument.create();
  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

  // Real LGMU letterhead PDF as the full-page background template — same
  // embedPdf/drawPage pattern used by Payout Schedule's LMC letterhead.
  const letterheadBytes = await fetchBytes(LETTERHEAD_URL);
  const [letterheadPage] = await pdfDoc.embedPdf(letterheadBytes, [0]);
  const PAGE_W = letterheadPage.width;
  const PAGE_H = letterheadPage.height;

  const MARGIN = 50;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const CONTENT_TOP = PAGE_H - 175; // just below the letterhead's logo/accent line

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = CONTENT_TOP;

  function drawLetterhead(p) {
    p.drawPage(letterheadPage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  }

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawLetterhead(page);
    y = CONTENT_TOP;
    page.drawText('Deed of Novation Report (cont\u2019d)', {
      x: MARGIN, y: y + 6, size: 10, font: fontBold, color: NAVY
    });
    y -= 14;
    drawFooter();
  }

  function drawFooter() {
    const pageNum = pdfDoc.getPageCount();
    page.drawText('LGMU Container Trading \u2014 Deed of Novation Report', {
      x: MARGIN, y: 85, size: 7.5, font, color: GRAY_TXT
    });
    page.drawText(`Page ${pageNum}`, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(`Page ${pageNum}`, 7.5), y: 85, size: 7.5, font, color: GRAY_TXT
    });
  }

  function ensureSpace(neededHeight) {
    if (y - neededHeight < 95) newPage();
  }

  // ── page 1: letterhead + title + stat boxes ──
  drawLetterhead(page);

  const genDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const modeLabel = mode === 'summary' ? 'Summary' : 'Full Report';
  page.drawText('Deed of Novation Report', { x: MARGIN, y: y - 4, size: 16, font: fontBold, color: NAVY });
  page.drawText(`Generated ${genDate} \u2014 ${modeLabel}`, {
    x: MARGIN, y: y - 20, size: 9, font, color: GRAY_TXT
  });
  y -= 42;

  const boxW = (CONTENT_W - 30) / 4;
  const boxH = 40;
  const teal = PDFLib.rgb(0x5B/255, 0xA7/255, 0x9A/255);
  const stats = [
    ['RECEIVED', r.totalReceived, teal],
    ['PENDING', r.totalPending, AMBER],
    ['REJECTED', r.totalRejected, RED],
    ['LEGAL', r.totalLegal, BLUE]
  ];
  stats.forEach(([label, val, color], i) => {
    const bx = MARGIN + i * (boxW + 10);
    page.drawRectangle({ x: bx, y: y - boxH, width: boxW, height: boxH, color });
    const valStr = String(val);
    page.drawText(valStr, { x: bx + boxW/2 - fontBold.widthOfTextAtSize(valStr, 15)/2, y: y - 18, size: 15, font: fontBold, color: WHITE });
    page.drawText(label, { x: bx + boxW/2 - font.widthOfTextAtSize(label, 7.5)/2, y: y - 33, size: 7.5, font, color: WHITE });
  });
  y -= (boxH + 22);

  drawFooter();

  function sectionHeader(title, color) {
    ensureSpace(28 + 17 + 17); // header line + table header row + at least 1 data row — avoids an orphaned header at the bottom of a page
    page.drawCircle({ x: MARGIN + 4, y: y - 4, size: 4, color });
    page.drawText(title, { x: MARGIN + 14, y: y - 8, size: 11.5, font: fontBold, color: DARK_TXT });
    y -= 20;
  }

  function drawTable(rows, headers, colWidths, headerColor) {
    const rowH = 17;
    ensureSpace(rowH * 2);
    page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_W, height: rowH, color: headerColor });
    let cx = MARGIN;
    headers.forEach((h, i) => {
      const w = colWidths[i];
      const align = i === 0 ? 'left' : 'center';
      const tw = fontBold.widthOfTextAtSize(h, 8);
      const tx = align === 'left' ? cx + 6 : cx + w/2 - tw/2;
      page.drawText(h, { x: tx, y: y - rowH + 5, size: 8, font: fontBold, color: WHITE });
      cx += w;
    });
    y -= rowH;

    rows.forEach((rowVals, idx) => {
      if (y - rowH < 95) {
        newPage();
        page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_W, height: rowH, color: headerColor });
        let cx2 = MARGIN;
        headers.forEach((h, i) => {
          const w = colWidths[i];
          const align = i === 0 ? 'left' : 'center';
          const tw = fontBold.widthOfTextAtSize(h, 8);
          const tx = align === 'left' ? cx2 + 6 : cx2 + w/2 - tw/2;
          page.drawText(h, { x: tx, y: y - rowH + 5, size: 8, font: fontBold, color: WHITE });
          cx2 += w;
        });
        y -= rowH;
      }
      if (idx % 2 === 1) {
        page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_W, height: rowH, color: LIGHT_ROW });
      }
      let cx3 = MARGIN;
      rowVals.forEach((val, i) => {
        const w = colWidths[i];
        const align = i === 0 ? 'left' : 'center';
        const str = String(val);
        const maxChars = Math.floor(w / 4.6);
        const clipped = str.length > maxChars ? str.slice(0, maxChars - 1) + '\u2026' : str;
        const tw = font.widthOfTextAtSize(clipped, 8);
        const tx = align === 'left' ? cx3 + 6 : cx3 + w/2 - tw/2;
        page.drawText(clipped, { x: tx, y: y - rowH + 5, size: 8, font, color: DARK_TXT });
        cx3 += w;
      });
      y -= rowH;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.4, color: PDFLib.rgb(0.86,0.86,0.86) });
    });
    y -= 14;
  }

  const nameColW = CONTENT_W * 0.72;
  const valColW = CONTENT_W - nameColW;

  function renderSection(title, color, list, valueHeader, valueFn, limit) {
    const items = limit ? list.slice(0, limit) : list;
    const willTruncate = limit && list.length > limit;

    // In summary mode (limit set), reserve room for the WHOLE block —
    // header + up to `limit` rows + the "and X more" caption — so the
    // section never splits across pages. Full mode (no limit) keeps the
    // normal per-row pagination since a section can legitimately span
    // many pages there.
    if (limit) {
      const rowH = 17;
      const bodyHeight = items.length > 0 ? (17 + items.length * rowH) : 14;
      const captionHeight = willTruncate ? 16 : 0;
      const totalNeeded = 20 + bodyHeight + captionHeight; // section title advance + table (header row + rows, or "None.") + caption
      ensureSpace(totalNeeded);
    }

    sectionHeader(`${title} (${list.length} client${list.length === 1 ? '' : 's'})`, color);
    if (items.length === 0) {
      page.drawText('None.', { x: MARGIN, y: y - 4, size: 9, font, color: GRAY_TXT });
      y -= 18;
      return;
    }
    const rows = items.map(item => [item.name, valueFn(item)]);
    drawTable(rows, ['Client Name', valueHeader], [nameColW, valColW], color);
    if (willTruncate) {
      page.drawText(`... and ${list.length - limit} more (summary truncated)`, { x: MARGIN, y: y - 4, size: 8, font, color: GRAY_TXT });
      y -= 16;
    }
  }

  const limit = mode === 'summary' ? 10 : null;
  renderSection('Completed', GREEN, r.completed, 'Deed Count', (item) => `${item.x}/${item.y}`, limit);
  renderSection('Pending', AMBER, r.pending, 'Deed Count', (item) => `${item.x}/${item.y}`, limit);
  renderSection('Rejected', RED, r.rejected, 'Container Count', (item) => item.containerCount, limit);
  renderSection('Legal', BLUE, r.legal, 'Container Count', (item) => item.containerCount, limit);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const modeFileTag = mode === 'summary' ? 'Summary' : 'Full';
  a.download = `Deed_of_Novation_Report_${modeFileTag}_${timestampTag()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── By Category PDF (agent + status, targeted list: Client Name / Deed or
// Container Count / Email Address) ────────────────────────────────────
async function exportCategoryDetailPdf(status) {
  closeStatusModal();
  if (!lastReport) return;
  const r = lastReport;
  const agent = pendingCategoryAgent;

  const NAVY = PDFLib.rgb(0x1B/255, 0x4B/255, 0x7A/255);
  const WHITE = PDFLib.rgb(1, 1, 1);
  const GRAY_TXT = PDFLib.rgb(0x55/255, 0x55/255, 0x55/255);
  const DARK_TXT = PDFLib.rgb(0.15, 0.15, 0.15);
  const LIGHT_ROW = PDFLib.rgb(0xEA/255, 0xF1/255, 0xF8/255);
  const STATUS_COLORS = {
    complete: PDFLib.rgb(0x2E/255, 0x7D/255, 0x32/255),
    partial: PDFLib.rgb(0xB9/255, 0x8A/255, 0x2E/255),
    zero: PDFLib.rgb(0.45, 0.45, 0.45),
    rejected: PDFLib.rgb(0xB0/255, 0x3A/255, 0x2E/255),
    legal: PDFLib.rgb(0x5B/255, 0x9B/255, 0xD5/255)
  };
  const STATUS_LABELS = { complete: 'Completed', partial: 'Partial', zero: 'Zero', rejected: 'Rejected', legal: 'Legal' };
  const headerColor = STATUS_COLORS[status];

  const inAgent = (name) => agent === 'all' || r.categoryMap.get(name) === agent;
  let source, valueFn, valueHeader;
  if (status === 'complete') { source = r.completed; valueFn = (item) => `${item.x}/${item.y}`; valueHeader = 'Deed Count'; }
  else if (status === 'partial') { source = r.pending.filter(item => item.x > 0); valueFn = (item) => `${item.x}/${item.y}`; valueHeader = 'Deed Count'; }
  else if (status === 'zero') { source = r.pending.filter(item => item.x === 0); valueFn = (item) => `${item.x}/${item.y}`; valueHeader = 'Deed Count'; }
  else if (status === 'rejected') { source = r.rejected; valueFn = (item) => item.containerCount; valueHeader = 'Container Count'; }
  else { source = r.legal; valueFn = (item) => item.containerCount; valueHeader = 'Container Count'; }

  const list = source.filter(item => inAgent(item.name)).map(item => ({
    name: item.name,
    value: valueFn(item),
    email: r.emailMap.get(item.name) || ''
  }));

  const pdfDoc = await PDFLib.PDFDocument.create();
  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

  const letterheadBytes = await fetchBytes('/assets/lgmu_letterhead.pdf');
  const [letterheadPage] = await pdfDoc.embedPdf(letterheadBytes, [0]);
  const PAGE_W = letterheadPage.width;
  const PAGE_H = letterheadPage.height;
  const MARGIN = 50;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const CONTENT_TOP = PAGE_H - 175;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = CONTENT_TOP;

  function drawLetterhead(p) { p.drawPage(letterheadPage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H }); }
  function drawFooter() {
    const pageNum = pdfDoc.getPageCount();
    page.drawText('LGMU Container Trading \u2014 Deed of Novation Report', { x: MARGIN, y: 85, size: 7.5, font, color: GRAY_TXT });
    page.drawText(`Page ${pageNum}`, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(`Page ${pageNum}`, 7.5), y: 85, size: 7.5, font, color: GRAY_TXT });
  }
  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawLetterhead(page);
    y = CONTENT_TOP;
    page.drawText('Deed of Novation Report (cont\u2019d)', { x: MARGIN, y: y + 6, size: 10, font: fontBold, color: NAVY });
    y -= 14;
    drawFooter();
  }

  drawLetterhead(page);
  const genDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const agentLabel = agent === 'all' ? 'All Agents' : agent;
  page.drawText('Deed of Novation Report', { x: MARGIN, y: y - 4, size: 16, font: fontBold, color: NAVY });
  page.drawText(`Generated ${genDate} \u2014 ${agentLabel} \u2014 ${STATUS_LABELS[status]} (${list.length} clients)`, {
    x: MARGIN, y: y - 20, size: 9, font, color: GRAY_TXT
  });
  y -= 34;
  drawFooter();

  const nameColW = CONTENT_W * 0.42;
  const valColW = CONTENT_W * 0.16;
  const emailColW = CONTENT_W - nameColW - valColW;
  const rowH = 17;

  function drawHeaderRow() {
    page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_W, height: rowH, color: headerColor });
    const headers = ['Client Name', valueHeader, 'Email Address'];
    const widths = [nameColW, valColW, emailColW];
    let cx = MARGIN;
    headers.forEach((h, i) => {
      page.drawText(h, { x: cx + 6, y: y - rowH + 5, size: 8, font: fontBold, color: WHITE });
      cx += widths[i];
    });
    y -= rowH;
  }

  drawHeaderRow();

  if (list.length === 0) {
    page.drawText('None.', { x: MARGIN, y: y - 4, size: 9, font, color: GRAY_TXT });
    y -= 18;
  }

  list.forEach((item, idx) => {
    if (y - rowH < 95) {
      newPage();
      drawHeaderRow();
    }
    if (idx % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_W, height: rowH, color: LIGHT_ROW });
    }
    const cells = [String(item.name), String(item.value), String(item.email)];
    const widths = [nameColW, valColW, emailColW];
    let cx = MARGIN;
    cells.forEach((val, i) => {
      const w = widths[i];
      const maxChars = Math.floor(w / 4.6);
      const clipped = val.length > maxChars ? val.slice(0, maxChars - 1) + '\u2026' : val;
      page.drawText(clipped, { x: cx + 6, y: y - rowH + 5, size: 8, font, color: DARK_TXT });
      cx += w;
    });
    y -= rowH;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.4, color: PDFLib.rgb(0.86, 0.86, 0.86) });
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const agentTag = agent === 'all' ? 'All' : agent.replace(/[^a-z0-9]/gi, '_');
  a.download = `Deed_of_Novation_Report_${agentTag}_${STATUS_LABELS[status]}_${timestampTag()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

// ── Excel equivalents of the PDF report views (Summary / Full / By Category) ──
function exportReportExcel(mode) {
  closePdfModal();
  if (!lastReport) return;
  const r = lastReport;

  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('Deed of Novation Report');
  ws.columns = [{ width: 42 }, { width: 16 }, { width: 14 }];

  ws.mergeCells('A1:C1');
  ws.getCell('A1').value = 'Deed of Novation Report';
  ws.getCell('A1').font = { name: 'Arial', size: 14, bold: true };

  const generatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const modeLabel = mode === 'summary' ? 'Summary' : 'Full';

  const summaryRows = [
    ['Received', r.totalReceived],
    ['Pending', r.totalPending],
    ['Rejected', r.totalRejected],
    ['Legal', r.totalLegal],
    ['Total Deeds', r.totalDeeds],
    ['Report Type', modeLabel],
    ['Generated At', generatedAt]
  ];
  let row = 3;
  summaryRows.forEach(([label, val]) => {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { name: 'Arial' };
    ws.getCell(`B${row}`).value = val;
    ws.getCell(`B${row}`).font = { name: 'Arial' };
    row++;
  });

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
  const limit = mode === 'summary' ? 10 : null;

  function writeGroup(title, list, valueLabel, valueFn) {
    row += 1;
    ws.getCell(`A${row}`).value = `${title} (${list.length} client${list.length === 1 ? '' : 's'})`;
    ws.getCell(`A${row}`).font = { name: 'Arial', bold: true };
    row++;
    ['Client Name', valueLabel].forEach((h, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = h;
      cell.font = { name: 'Arial', bold: true };
      cell.fill = headerFill;
      cell.alignment = { horizontal: 'center' };
    });
    row++;
    const items = limit ? list.slice(0, limit) : list;
    items.forEach(item => {
      ws.getCell(`A${row}`).value = item.name;
      ws.getCell(`A${row}`).font = { name: 'Arial' };
      ws.getCell(`B${row}`).value = valueFn(item);
      ws.getCell(`B${row}`).font = { name: 'Arial' };
      ws.getCell(`B${row}`).alignment = { horizontal: 'center' };
      row++;
    });
    if (limit && list.length > limit) {
      ws.getCell(`A${row}`).value = `... and ${list.length - limit} more (summary truncated)`;
      ws.getCell(`A${row}`).font = { name: 'Arial', italic: true, color: { argb: 'FF888888' } };
      row++;
    }
  }

  writeGroup('Completed', r.completed, 'Deed Count', (item) => `${item.x}/${item.y}`);
  writeGroup('Pending', r.pending, 'Deed Count', (item) => `${item.x}/${item.y}`);
  writeGroup('Rejected', r.rejected, 'Container Count', (item) => item.containerCount);
  writeGroup('Legal', r.legal, 'Container Count', (item) => item.containerCount);

  wb.xlsx.writeBuffer().then(buffer => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Deed_of_Novation_Report_${modeLabel}_${timestampTag()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

function exportCategoryDetailExcel(status) {
  closeStatusModal();
  if (!lastReport) return;
  const r = lastReport;
  const agent = pendingCategoryAgent;

  const STATUS_LABELS = { complete: 'Completed', partial: 'Partial', zero: 'Zero', rejected: 'Rejected', legal: 'Legal' };
  const inAgent = (name) => agent === 'all' || r.categoryMap.get(name) === agent;
  let source, valueFn, valueHeader;
  if (status === 'complete') { source = r.completed; valueFn = (item) => `${item.x}/${item.y}`; valueHeader = 'Deed Count'; }
  else if (status === 'partial') { source = r.pending.filter(item => item.x > 0); valueFn = (item) => `${item.x}/${item.y}`; valueHeader = 'Deed Count'; }
  else if (status === 'zero') { source = r.pending.filter(item => item.x === 0); valueFn = (item) => `${item.x}/${item.y}`; valueHeader = 'Deed Count'; }
  else if (status === 'rejected') { source = r.rejected; valueFn = (item) => item.containerCount; valueHeader = 'Container Count'; }
  else { source = r.legal; valueFn = (item) => item.containerCount; valueHeader = 'Container Count'; }

  const list = source.filter(item => inAgent(item.name)).map(item => ({
    name: item.name,
    value: valueFn(item),
    email: r.emailMap.get(item.name) || ''
  }));

  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('Deed of Novation Report');
  ws.columns = [{ width: 42 }, { width: 16 }, { width: 34 }];

  const agentLabel = agent === 'all' ? 'All Agents' : agent;
  ws.mergeCells('A1:C1');
  ws.getCell('A1').value = 'Deed of Novation Report';
  ws.getCell('A1').font = { name: 'Arial', size: 14, bold: true };

  const generatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
  ws.getCell('A3').value = 'Agent';
  ws.getCell('B3').value = agentLabel;
  ws.getCell('A4').value = 'Status';
  ws.getCell('B4').value = STATUS_LABELS[status];
  ws.getCell('A5').value = 'Client Count';
  ws.getCell('B5').value = list.length;
  ws.getCell('A6').value = 'Generated At';
  ws.getCell('B6').value = generatedAt;
  for (let rr = 3; rr <= 6; rr++) {
    ws.getCell(`A${rr}`).font = { name: 'Arial', bold: true };
    ws.getCell(`B${rr}`).font = { name: 'Arial' };
  }

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
  let row = 8;
  ['Client Name', valueHeader, 'Email Address'].forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { name: 'Arial', bold: true };
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center' };
  });
  row++;
  list.forEach(item => {
    ws.getCell(`A${row}`).value = item.name;
    ws.getCell(`A${row}`).font = { name: 'Arial' };
    ws.getCell(`B${row}`).value = item.value;
    ws.getCell(`B${row}`).font = { name: 'Arial' };
    ws.getCell(`B${row}`).alignment = { horizontal: 'center' };
    ws.getCell(`C${row}`).value = item.email;
    ws.getCell(`C${row}`).font = { name: 'Arial' };
    row++;
  });

  wb.xlsx.writeBuffer().then(buffer => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const agentTag = agent === 'all' ? 'All' : agent.replace(/[^a-z0-9]/gi, '_');
    a.download = `Deed_of_Novation_Report_${agentTag}_${STATUS_LABELS[status]}_${timestampTag()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
