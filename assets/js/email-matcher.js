// ─────────────────────────────────────────────────────────────────
// EMAIL MATCHER MODE — email-matcher.js
// Standalone module — mounts into #emailMatcherMount via EmailMatcherStandalone.init()
// Depends on: shared.js, app.js (esc, normalizeName, PREVIEW_COUNT, MONTHS)
// ─────────────────────────────────────────────────────────────────

window.EmailMatcherStandalone = (function () {

  let mountId = '';
  let inited = false;

  let file1Workbook = null;     // raw XLSX workbook
  let file1Sheets = [];         // [{name, headerRowIdx, clientCol, rows}]
  let selectedSheetNames = [];  // sheets to process
  let emailData = [];           // raw rows from email sheet
  let emailRecords = [];        // built lookup records
  let outputBySheet = {};       // { sheetName: [{...rowResult}] }

  // ── Helpers ──────────────────────────────────────────────────

  function q(sel) { return document.getElementById(mountId).querySelector(sel); }
  function qa(sel) { return document.getElementById(mountId).querySelectorAll(sel); }

  function findClientNameHeader(rows) {
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (v && String(v).toLowerCase().trim().includes('client name')) {
          return { headerRowIdx: i, clientCol: c };
        }
      }
    }
    return null;
  }

  function splitEmails(value) {
    const text = String(value || '').trim();
    if (!text) return ['', ''];
    const parts = text.split(/[,:;\s]+/).map(p => p.trim()).filter(Boolean);
    return [parts[0] || '', parts[1] || ''];
  }

  function parseDateValue(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (!parsed) return '';
      return `${String(parsed.d).padStart(2,'0')}/${String(parsed.m).padStart(2,'0')}/${parsed.y}`;
    }
    return '';
  }

  // ── Build email sheet lookup records (unchanged matching logic) ──

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
      const emails     = emailRaw.split(/[,:;\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean);

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

  function lookupMatch(rawClientName) {
    const norm      = normalizeName(rawClientName, false);
    const parenMatch = rawClientName.match(/\(([^)]+)\)/);
    const normParen  = parenMatch ? normalizeName(parenMatch[1], true) : '';
    const normOuter  = normalizeName(rawClientName.replace(/\([^)]*\)/g, ' ').trim(), true);
    const find = n => emailRecords.find(r => r.normName === n || r.normParen === n);
    return (normParen && find(normParen)) || find(normOuter) || find(norm) || null;
  }

  // ── File 1 handling ──────────────────────────────────────────

  function handleFile1(buf, filename) {
    const errEl = q('#em-file1-error');
    errEl.className = 'msg'; errEl.textContent = '';

    let wb;
    try {
      wb = XLSX.read(buf, { type: 'array', cellDates: false });
    } catch (ex) {
      errEl.className = 'msg error show';
      errEl.textContent = 'Error reading file: ' + ex.message;
      return;
    }

    const sheetsFound = [];
    wb.SheetNames.forEach(name => {
      const ws = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
      const hdr = findClientNameHeader(rows);
      if (hdr) sheetsFound.push({ name, headerRowIdx: hdr.headerRowIdx, clientCol: hdr.clientCol, rows });
    });

    if (sheetsFound.length === 0) {
      errEl.className = 'msg error show';
      errEl.textContent = '⚠ No "CLIENT NAME" column header found in this file. Tool cannot proceed.';
      file1Workbook = null;
      file1Sheets = [];
      q('#em-file1-loaded').classList.remove('show');
      q('#em-sheet-select-card').style.display = 'none';
      checkReady();
      return;
    }

    file1Workbook = wb;
    file1Sheets = sheetsFound;
    selectedSheetNames = [sheetsFound[0].name]; // first qualifying sheet always on

    q('#em-file1-loaded').classList.add('show');
    q('#em-file1-loaded-name').textContent = filename;
    q('#em-file1-loaded-meta').textContent = `${sheetsFound.length} tab(s) with CLIENT NAME found`;

    renderSheetSelector();
    checkReady();
  }

  function renderSheetSelector() {
    const card = q('#em-sheet-select-card');
    const list = q('#em-sheet-list');
    if (file1Sheets.length <= 1) {
      card.style.display = 'none';
      return;
    }
    card.style.display = 'block';
    list.innerHTML = file1Sheets.map((s, i) => {
      const checked = i === 0 ? 'checked disabled' : (selectedSheetNames.includes(s.name) ? 'checked' : '');
      return `<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--liq-text);padding:6px 0;">
        <input type="checkbox" data-sheet="${esc(s.name)}" ${checked} style="width:16px;height:16px;">
        ${esc(s.name)} ${i === 0 ? '<span style="color:var(--liq-text-hint);font-size:11px;">(default)</span>' : ''}
      </label>`;
    }).join('');

    list.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        const name = cb.dataset.sheet;
        if (cb.checked) {
          if (!selectedSheetNames.includes(name)) selectedSheetNames.push(name);
        } else {
          selectedSheetNames = selectedSheetNames.filter(n => n !== name);
        }
      });
    });
  }

  // ── Email sheet handling ─────────────────────────────────────

  function handleEmailFile(buf, filename) {
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    emailData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
    q('#em-file2-loaded').classList.add('show');
    q('#em-file2-loaded-name').textContent = filename;
    checkReady();
  }

  // ── Ready check ──────────────────────────────────────────────

  function checkReady() {
    const btn  = q('#em-generate-btn');
    const hint = q('#em-generate-hint');
    const ready = file1Sheets.length > 0 && emailData.length > 0;
    btn.disabled = !ready;
    hint.textContent = ready
      ? 'Ready to generate'
      : file1Sheets.length === 0
        ? 'Upload File 1 (with CLIENT NAME column) to continue'
        : 'Upload email sheet to continue';
  }

  // ── Generate ─────────────────────────────────────────────────

  function generate() {
    emailRecords = buildEmailRecords();
    outputBySheet = {};

    let totalRows = 0, totalMatched = 0;

    selectedSheetNames.forEach(sheetName => {
      const sheet = file1Sheets.find(s => s.name === sheetName);
      if (!sheet) return;

      const headers = sheet.rows[sheet.headerRowIdx].map(h => h != null ? String(h) : '');
      const dataRows = sheet.rows.slice(sheet.headerRowIdx + 1).filter(r => r && r.some(v => v !== null && v !== ''));

      const results = dataRows.map(row => {
        const rawClientName = row[sheet.clientCol] != null ? String(row[sheet.clientCol]).trim() : '';
        let matched = null, notes = '';
        if (!rawClientName) {
          notes = '';
        } else {
          matched = lookupMatch(rawClientName);
          notes = matched ? '' : 'No match found';
        }

        const [email1, email2] = matched ? splitEmails(matched.clientEmailRaw) : ['', ''];

        return {
          originalRow: row,
          rawClientName,
          emailSheetClientName: matched ? matched.emailSheetClientName : '',
          email1, email2,
          mobile: matched ? matched.mobile : '',
          nationality: matched ? matched.nationality : '',
          eid: matched ? matched.eid : '',
          notes,
          matched: !!matched,
        };
      });

      outputBySheet[sheetName] = { headers, results };
      totalRows += results.length;
      totalMatched += results.filter(r => r.matched).length;
    });

    renderPreview(totalRows, totalMatched);
  }

  // ── Preview ──────────────────────────────────────────────────

  function renderPreview(totalRows, totalMatched) {
    const resCard = q('#em-results-card');
    resCard.style.display = 'block';

    const firstSheet = selectedSheetNames[0];
    const data = outputBySheet[firstSheet];

    q('#em-results-title').textContent =
      `${selectedSheetNames.length} tab(s) · ${totalRows} rows · ${totalMatched} matched`;

    document.getElementById(mountId).querySelector('#em-table-head').innerHTML = `<tr>
      <th>#</th>
      <th>Client Name</th>
      <th>Client Name (Email Sheet)</th>
      <th>Email 1</th>
      <th>Mobile</th>
      <th>Notes</th>
    </tr>`;

    document.getElementById(mountId).querySelector('#em-table-body').innerHTML =
      data.results.slice(0, PREVIEW_COUNT).map((r, i) => {
        const noteBadge = r.notes
          ? `<span class="badge badge-flag">${esc(r.notes)}</span>`
          : (r.matched ? `<span class="badge badge-ok">Matched</span>` : '');
        return `<tr>
          <td class="td-hint">${i+1}</td>
          <td class="td-name">${esc(r.rawClientName || '—')}</td>
          <td style="color:var(--text-muted);font-size:12px">${esc(r.emailSheetClientName || '—')}</td>
          <td class="td-mono">${esc(r.email1 || '—')}</td>
          <td class="td-mono">${esc(r.mobile || '—')}</td>
          <td class="td-note">${noteBadge}</td>
        </tr>`;
      }).join('');

    const moreEl = q('#em-more-rows');
    if (data.results.length > PREVIEW_COUNT) {
      moreEl.style.display = 'block';
      moreEl.textContent = `+ ${data.results.length - PREVIEW_COUNT} more rows in this tab · all included in export`;
    } else {
      moreEl.style.display = 'none';
    }

    if (selectedSheetNames.length > 1) {
      q('#em-multi-note').style.display = 'block';
      q('#em-multi-note').textContent = `Showing preview for "${firstSheet}" tab only. All ${selectedSheetNames.length} selected tabs are included in the export.`;
    } else {
      q('#em-multi-note').style.display = 'none';
    }
  }

  // ── Export ───────────────────────────────────────────────────

  function exportResults() {
    if (!Object.keys(outputBySheet).length) return;

    const wb = XLSX.utils.book_new();

    selectedSheetNames.forEach(sheetName => {
      const data = outputBySheet[sheetName];
      if (!data) return;

      const exportRows = data.results.map(r => {
        const row = {};
        data.headers.forEach((h, idx) => { row[h || `Col${idx+1}`] = r.originalRow[idx]; });
        row['CLIENT NAME (EMAIL SHEET)']        = r.emailSheetClientName;
        row['EMAIL 1']                          = r.email1;
        row['EMAIL 2']                          = r.email2;
        row['MOBILE']                           = r.mobile;
        row['NATIONALITY']                      = r.nationality;
        row['EID/PASSPORT/NATIONAL CARD']       = r.eid;
        row['NOTES']                            = r.notes;
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const safeName = sheetName.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, safeName);
    });

    const today = new Date();
    const dd = String(today.getDate()).padStart(2,'0');
    const mmm = MONTHS[today.getMonth()].toUpperCase();
    const yyyy = today.getFullYear();
    XLSX.writeFile(wb, `EMAIL_MATCHER_${dd}${mmm}${yyyy}.xlsx`);
  }

  // ── Upload zone wiring ───────────────────────────────────────

  function setupUpload(inputId, zoneId, onLoad) {
    const mount = document.getElementById(mountId);
    const input = mount.querySelector(`#${inputId}`);
    const zone  = mount.querySelector(`#${zoneId}`);
    if (!input || !zone) return;

    input.addEventListener('change', e => handleFile(e.target.files[0]));
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });

    function handleFile(file) {
      if (!file) return;
      if (!file.name.match(/\.(xlsx|xls)$/i)) return;
      const reader = new FileReader();
      reader.onload = ev => onLoad(ev.target.result, file.name);
      reader.readAsArrayBuffer(file);
    }
  }

  // ── Build UI ─────────────────────────────────────────────────

  function buildUI() {
    const mount = document.getElementById(mountId);
    mount.innerHTML = `
      <div class="card">
        <div class="section-label">Upload files</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-hint);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">File 1 <span class="optional-label">needs CLIENT NAME column</span></div>
            <div class="upload-zone upload-zone-sm" id="em-zone-file1">
              <input type="file" accept=".xlsx,.xls" id="em-input-file1">
              <div class="upload-zone-text"><strong>Click to upload</strong><span>any file</span></div>
            </div>
            <div class="file-loaded" id="em-file1-loaded">
              <span>✓</span>
              <div>
                <div class="file-loaded-name" id="em-file1-loaded-name">—</div>
                <div class="file-loaded-meta" id="em-file1-loaded-meta">—</div>
              </div>
            </div>
            <div class="msg" id="em-file1-error"></div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-hint);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Email Sheet</div>
            <div class="upload-zone upload-zone-sm" id="em-zone-file2">
              <input type="file" accept=".xlsx,.xls" id="em-input-file2">
              <div class="upload-zone-text"><strong>Click to upload</strong><span>email sheet</span></div>
            </div>
            <div class="file-loaded" id="em-file2-loaded">
              <span>✓</span>
              <div class="file-loaded-name" id="em-file2-loaded-name">—</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" id="em-sheet-select-card" style="display:none;">
        <div class="section-label">Multiple tabs detected</div>
        <p class="card-hint">Select which tabs to also match. The first tab is included by default.</p>
        <div id="em-sheet-list"></div>
      </div>

      <div class="btn-row">
        <button class="btn-primary" id="em-generate-btn" disabled>Generate</button>
        <span class="generate-hint" id="em-generate-hint">Upload File 1 (with CLIENT NAME column) to continue</span>
      </div>

      <div id="em-results-card" class="card" style="display:none;margin-top:1rem;">
        <div class="results-header">
          <div>
            <div class="section-label" style="margin-bottom:2px;">Results</div>
            <div class="results-title" id="em-results-title">—</div>
          </div>
          <button class="btn-primary" id="em-export-btn">↓ Export to Excel</button>
        </div>
        <p class="card-hint" id="em-multi-note" style="display:none;"></p>
        <div class="table-wrap">
          <table>
            <thead id="em-table-head"></thead>
            <tbody id="em-table-body"></tbody>
          </table>
          <div class="more-rows" id="em-more-rows" style="display:none;"></div>
        </div>
      </div>
    `;
  }

  // ── Init ─────────────────────────────────────────────────────

  function init(id) {
    mountId = id;
    if (inited) return;
    inited = true;

    buildUI();
    setupUpload('em-input-file1', 'em-zone-file1', handleFile1);
    setupUpload('em-input-file2', 'em-zone-file2', handleEmailFile);

    q('#em-generate-btn').addEventListener('click', generate);
    q('#em-export-btn').addEventListener('click', exportResults);
  }

  return { init };

})();
