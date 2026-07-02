// ─────────────────────────────────────────────────────────────────
// PAYOUT SCHEDULE — payout-schedule.js
// Depends on: shared.js (parseDate, parseNumber, fmtDate, esc, buildEmailRecords,
//             lookupEmailRecord, splitEmails), app.js (parsePaymentSheet, readExcel)
// Generates a full multi-year Payment Schedule PDF for one client,
// matching the LMC letterhead template.
// ─────────────────────────────────────────────────────────────────

window.PayoutSchedule = (function () {

  // ───────────────────────────────────────────────────────────
  // ASSET PATHS — adjust if your repo's image folder differs
  // ───────────────────────────────────────────────────────────
  const LOGO_URL      = '/assets/img/logo-1.png';
  const FOOT_LOGO_URL = '/assets/img/foot-logo-1.png';

  const NEW_INSURANCE_FROM = new Date(2026, 5, 30); // 30 Jun 2026

  let scheduleRows  = [];   // parsed payment sheet rows (own copy, independent of Payout Generator)
  let clientGroups  = [];   // grouped-by-contract client list
  let selectedGroup = null;
  let emailRecords  = [];
  let mountEl       = null;

  // ───────────────────────────────────────────────────────────
  // INIT
  // ───────────────────────────────────────────────────────────
  function init(mountId) {
    mountEl = document.getElementById(mountId);
    mountEl.innerHTML = buildHTML();
    injectStyles();
    bindEvents();
  }

  function buildHTML() {
    return `
      <div class="upload-row">
        <div class="card">
          <div class="section-label">Payment Info Sheet <span class="optional-label">required</span></div>
          <div class="upload-zone upload-zone-sm" id="ps-uploadZone">
            <input type="file" id="ps-fileInput" accept=".xlsx,.xls" />
            <div class="upload-zone-text"><strong>Click to upload</strong>.xlsx or .xls</div>
          </div>
          <div class="file-loaded" id="ps-fileLoaded">
            <span>&#10003;</span>
            <div><div class="file-loaded-name" id="ps-loadedName">&mdash;</div>
            <div class="file-loaded-meta" id="ps-loadedMeta">&mdash;</div></div>
          </div>
          <div class="msg error" id="ps-fileError"></div>
        </div>
        <div class="card">
          <div class="section-label">Email Sheet <span class="optional-label">optional</span></div>
          <div class="upload-zone upload-zone-sm" id="ps-emailZone">
            <input type="file" id="ps-emailInput" accept=".xlsx,.xls" />
            <div class="upload-zone-text"><strong>Click to upload</strong>.xlsx or .xls</div>
          </div>
          <div class="file-loaded" id="ps-emailLoaded">
            <span>&#10003;</span>
            <div><div class="file-loaded-name" id="ps-emailName">&mdash;</div></div>
          </div>
          <div class="msg error" id="ps-emailError"></div>
        </div>
      </div>

      <div class="card" id="ps-clientCard" style="display:none;">
        <div class="section-label">Select Client</div>
        <div class="ps-search-wrap">
          <input type="text" id="ps-clientSearch" placeholder="Type client name to search..." autocomplete="off" />
          <div class="ps-dropdown" id="ps-clientDropdown"></div>
        </div>
      </div>

      <div class="card" id="ps-formCard" style="display:none;">
        <div class="section-label">Schedule Details <span class="optional-label">auto-filled &middot; editable before export</span></div>
        <div class="selector-row">
          <div class="selector-group"><label>Client Name</label><input type="text" id="ps-clientName" /></div>
          <div class="selector-group"><label>Email</label><input type="text" id="ps-clientEmail" /></div>
          <div class="selector-group"><label>Contract Ref</label><input type="text" id="ps-contractRef" /></div>
        </div>
        <div class="selector-row">
          <div class="selector-group"><label>First Payout Date</label><input type="date" id="ps-firstPayout" /></div>
          <div class="selector-group"><label>Cycle</label><input type="text" id="ps-cycle" readonly /></div>
          <div class="selector-group"><label>Total Months</label><input type="number" id="ps-totalMonths" min="1" /></div>
        </div>
        <div class="selector-row">
          <div class="selector-group"><label>Monthly Rent (AED)</label><input type="number" id="ps-rent" /></div>
          <div class="selector-group"><label>Insurance Premium / yr (AED)</label><input type="number" id="ps-insurance" /></div>
          <div class="selector-group">
            <label class="ps-checkbox-label"><input type="checkbox" id="ps-hcToggle" /> Health Check (Yr 2 &amp; 3)</label>
            <input type="number" id="ps-hcAmount" placeholder="e.g. 1000 or 1100" disabled />
          </div>
        </div>
        <div class="selector-group" style="margin-top:0.75rem;">
          <label>Container Numbers <span class="optional-label">one per line, in order &middot; blank rows after list runs out</span></label>
          <textarea id="ps-containers" rows="4"></textarea>
        </div>
      </div>

      <div class="card action-card" id="ps-genCard" style="display:none;">
        <button class="btn-primary" id="ps-generateBtn">Generate PDF</button>
        <div class="msg" id="ps-genError"></div>
      </div>
    `;
  }

  function injectStyles() {
    if (document.getElementById('ps-styles')) return;
    const style = document.createElement('style');
    style.id = 'ps-styles';
    style.textContent = `
      .ps-search-wrap { position: relative; }
      .ps-search-wrap input[type="text"] {
        width: 100%; box-sizing: border-box; height: 42px; padding: 0 12px;
        border-radius: 8px; border: 1px solid var(--border, #ccc);
        background: var(--bg, #fff); color: var(--text, #111); font-size: 14px;
      }
      .ps-dropdown {
        display: none; position: absolute; top: 46px; left: 0; right: 0;
        max-height: 260px; overflow-y: auto; z-index: 20;
        background: var(--bg, #fff); border: 1px solid var(--border, #ccc);
        border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      }
      .ps-dropdown.show { display: block; }
      .ps-dropdown-item { padding: 10px 12px; cursor: pointer; font-size: 13px; color: var(--text, #111); }
      .ps-dropdown-item:hover, .ps-dropdown-item.active { background: var(--accent, #eee); }
      .ps-dropdown-empty { padding: 10px 12px; font-size: 13px; color: var(--text-hint, #888); }
      #ps-formCard input[type="text"], #ps-formCard input[type="date"],
      #ps-formCard input[type="number"], #ps-formCard textarea {
        width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px;
        border: 1px solid var(--border, #ccc); background: var(--bg, #fff);
        color: var(--text, #111); font-size: 13px; font-family: inherit;
      }
      #ps-formCard textarea { resize: vertical; }
      .ps-checkbox-label { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
      .ps-checkbox-label input { width: auto; }
    `;
    document.head.appendChild(style);
  }

  // ───────────────────────────────────────────────────────────
  // EVENTS
  // ───────────────────────────────────────────────────────────
  function bindEvents() {
    const uploadZone = document.getElementById('ps-uploadZone');
    uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', e => {
      e.preventDefault(); uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handleSheetFile(e.dataTransfer.files[0]);
    });
    document.getElementById('ps-fileInput').addEventListener('change', e => {
      if (e.target.files[0]) handleSheetFile(e.target.files[0]);
    });

    const emailZone = document.getElementById('ps-emailZone');
    emailZone.addEventListener('dragover', e => { e.preventDefault(); emailZone.classList.add('dragover'); });
    emailZone.addEventListener('dragleave', () => emailZone.classList.remove('dragover'));
    emailZone.addEventListener('drop', e => {
      e.preventDefault(); emailZone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handleEmailFile(e.dataTransfer.files[0]);
    });
    document.getElementById('ps-emailInput').addEventListener('change', e => {
      if (e.target.files[0]) handleEmailFile(e.target.files[0]);
    });

    const search = document.getElementById('ps-clientSearch');
    search.addEventListener('input', () => renderDropdown(search.value));
    search.addEventListener('focus', () => renderDropdown(search.value));
    document.addEventListener('click', e => {
      if (!e.target.closest('.ps-search-wrap')) {
        document.getElementById('ps-clientDropdown').classList.remove('show');
      }
    });

    document.getElementById('ps-hcToggle').addEventListener('change', e => {
      document.getElementById('ps-hcAmount').disabled = !e.target.checked;
    });

    document.getElementById('ps-generateBtn').addEventListener('click', onGenerate);
  }

  function handleSheetFile(file) {
    showMsg('ps-fileError', '');
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      showMsg('ps-fileError', 'Please upload an Excel file (.xlsx or .xls)', 'error'); return;
    }
    readExcel(file, rows => {
      scheduleRows = parsePaymentSheet(rows);
      clientGroups = groupClients(scheduleRows);
      document.getElementById('ps-fileLoaded').classList.add('show');
      document.getElementById('ps-loadedName').textContent = file.name;
      document.getElementById('ps-loadedMeta').textContent = `${clientGroups.length} clients found`;
      document.getElementById('ps-clientCard').style.display = 'block';
    }, err => showMsg('ps-fileError', 'Error reading file: ' + err, 'error'));
  }

  function handleEmailFile(file) {
    showMsg('ps-emailError', '');
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      showMsg('ps-emailError', 'Please upload an Excel file (.xlsx or .xls)', 'error'); return;
    }
    readExcel(file, rows => {
      emailData = rows; // shared global from app.js — used by buildEmailRecords()
      emailRecords = buildEmailRecords();
      document.getElementById('ps-emailLoaded').classList.add('show');
      document.getElementById('ps-emailName').textContent = file.name;
      // Re-fill email field if a client is already selected
      if (selectedGroup) {
        const rec = lookupEmailRecord(emailRecords, selectedGroup.clientName);
        if (rec) document.getElementById('ps-clientEmail').value = splitEmails(rec.clientEmailRaw)[0] || '';
      }
    }, err => showMsg('ps-emailError', 'Error reading email file: ' + err, 'error'));
  }

  function showMsg(id, text, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'msg' + (text ? ` show ${type || 'error'}` : '');
  }

  // ───────────────────────────────────────────────────────────
  // GROUP ROWS INTO CLIENTS/CONTRACTS
  // ───────────────────────────────────────────────────────────
  function groupClients(rows) {
    const map = new Map();
    rows.forEach(r => {
      const noNumber = !r.contractNo || r.contractNo.toLowerCase() === 'no number';
      const key = noNumber ? r.clientName : r.contractNo;
      if (!map.has(key)) {
        map.set(key, { key, clientName: r.clientName, contractNo: noNumber ? '' : r.contractNo, containers: [], row: r });
      }
      const g = map.get(key);
      if (r.container && !r.pinFilledDown && !g.containers.includes(r.container)) g.containers.push(r.container);
    });
    return Array.from(map.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }

  // ───────────────────────────────────────────────────────────
  // SEARCHABLE DROPDOWN
  // ───────────────────────────────────────────────────────────
  function renderDropdown(query) {
    const dd = document.getElementById('ps-clientDropdown');
    const q = (query || '').trim().toLowerCase();
    const matches = (q ? clientGroups.filter(g => g.clientName.toLowerCase().includes(q)) : clientGroups).slice(0, 50);
    if (!matches.length) {
      dd.innerHTML = `<div class="ps-dropdown-empty">No matching clients</div>`;
    } else {
      dd.innerHTML = matches.map(g =>
        `<div class="ps-dropdown-item" data-key="${esc(g.key)}">${esc(g.clientName)}${g.contractNo ? ` <span style="color:var(--text-hint)">(${esc(g.contractNo)})</span>` : ''}</div>`
      ).join('');
      dd.querySelectorAll('.ps-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          const g = clientGroups.find(c => c.key === item.dataset.key);
          if (g) selectClient(g);
          dd.classList.remove('show');
        });
      });
    }
    dd.classList.add('show');
  }

  // ───────────────────────────────────────────────────────────
  // BUSINESS LOGIC — rerouted detection + effective values
  // ───────────────────────────────────────────────────────────
  function isNonReroutedClient(r) {
    if (!r.restartDate) return true;
    const sameDate = r.firstPayout &&
      r.firstPayout.getFullYear() === r.restartDate.getFullYear() &&
      r.firstPayout.getMonth()    === r.restartDate.getMonth() &&
      r.firstPayout.getDate()     === r.restartDate.getDate();
    const sameAmount = r.returnAmt === r.revisedRental;
    return sameDate && sameAmount;
  }

  function insuranceAmount(containerType, firstPayout) {
    if (!firstPayout || firstPayout < NEW_INSURANCE_FROM) return 1500;
    const s = String(containerType || '').toUpperCase();
    if (['SPECIAL', 'OPEN', 'THERMAL', 'SIDE'].some(k => s.includes(k))) return 2600;
    const is20 = s.includes('20') && !s.includes('40');
    return is20 ? 1500 : 1800;
  }

  function selectClient(g) {
    selectedGroup = g;
    const r = g.row;
    const rerouted   = !isNonReroutedClient(r);
    const effStart   = rerouted ? r.restartDate : r.firstPayout;
    const effRent    = rerouted ? r.revisedRental : r.returnAmt;
    const totalMonths = rerouted ? r.updatedTrips : r.numberOfTrips;
    const insurance  = rerouted ? 1500 : insuranceAmount(r.containerType, effStart);

    document.getElementById('ps-clientSearch').value = g.clientName;
    document.getElementById('ps-clientName').value = g.clientName;
    document.getElementById('ps-contractRef').value = g.contractNo || g.clientName;

    const rec = emailRecords.length ? lookupEmailRecord(emailRecords, g.clientName) : null;
    document.getElementById('ps-clientEmail').value = rec ? (splitEmails(rec.clientEmailRaw)[0] || '') : '';

    document.getElementById('ps-firstPayout').value = effStart ? toDateInputValue(effStart) : '';
    document.getElementById('ps-cycle').value = effStart ? (effStart.getDate() <= 15 ? '15th' : 'End of Month') : '';
    document.getElementById('ps-totalMonths').value = totalMonths || 36;
    document.getElementById('ps-rent').value = effRent || 0;
    document.getElementById('ps-insurance').value = insurance;
    document.getElementById('ps-hcToggle').checked = false;
    document.getElementById('ps-hcAmount').value = '';
    document.getElementById('ps-hcAmount').disabled = true;
    document.getElementById('ps-containers').value = g.containers.join('\n');

    document.getElementById('ps-formCard').style.display = 'block';
    document.getElementById('ps-genCard').style.display = 'block';
  }

  function toDateInputValue(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ───────────────────────────────────────────────────────────
  // SCHEDULE MATH
  // ───────────────────────────────────────────────────────────
  function yearBlocks(totalMonths, isRerouted) {
    const blocks = [];
    if (totalMonths <= 0) return blocks;
    if (isRerouted) {
      let remaining = totalMonths;
      while (remaining > 0) { const c = Math.min(12, remaining); blocks.push(c); remaining -= c; }
    } else {
      let remainder = totalMonths % 12;
      if (remainder === 0) remainder = 12;
      const first = Math.min(remainder, totalMonths);
      blocks.push(first);
      let remaining = totalMonths - first;
      while (remaining > 0) { const c = Math.min(12, remaining); blocks.push(c); remaining -= c; }
    }
    return blocks;
  }

  function generateDates(startDate, cycle, totalMonths) {
    const dates = [];
    const baseYear = startDate.getFullYear();
    const baseMonth = startDate.getMonth();
    for (let i = 0; i < totalMonths; i++) {
      const idx = baseMonth + i;
      const year = baseYear + Math.floor(idx / 12);
      const month = ((idx % 12) + 12) % 12;
      if (cycle === 'eom') {
        const lastDay = new Date(year, month + 1, 0).getDate();
        dates.push(new Date(year, month, lastDay));
      } else {
        dates.push(new Date(year, month, 15));
      }
    }
    return dates;
  }

  function buildScheduleRows(opts) {
    const { startDate, cycle, totalMonths, rent, insurance, hcEnabled, hcAmount, containers, rerouted } = opts;
    const blocks = yearBlocks(totalMonths, rerouted);
    const dates = generateDates(startDate, cycle, totalMonths);

    const out = [];
    let monthCursor = 0;
    let containerCursor = 0;

    blocks.forEach((blockLen, yearIdx) => {
      for (let m = 0; m < blockLen; m++) {
        const isYearStart = m === 0;
        let deductionAmount = 0;
        let deductionLabel = '';
        if (isYearStart) {
          if (yearIdx === 0) {
            deductionAmount = insurance;
            deductionLabel = 'Insurance Premium';
          } else if (hcEnabled) {
            deductionAmount = insurance + hcAmount;
            deductionLabel = 'Insurance Premium & Health Check';
          } else {
            deductionAmount = insurance;
            deductionLabel = 'Insurance Premium';
          }
        }
        const container = containerCursor < containers.length ? containers[containerCursor] : '';
        if (container) containerCursor++;

        out.push({
          yearIndex: yearIdx,
          isYearStart,
          container,
          date: dates[monthCursor],
          monthlyPayment: rent - deductionAmount,
          deductionAmount,
          deductionLabel,
        });
        monthCursor++;
      }
    });
    return { rows: out, blocks };
  }

  // ───────────────────────────────────────────────────────────
  // GENERATE — orchestrator
  // ───────────────────────────────────────────────────────────
  async function onGenerate() {
    showMsg('ps-genError', '');
    const btn = document.getElementById('ps-generateBtn');
    try {
      const clientName = document.getElementById('ps-clientName').value.trim();
      const clientEmail = document.getElementById('ps-clientEmail').value.trim();
      const contractRef = document.getElementById('ps-contractRef').value.trim() || clientName;
      const firstPayoutStr = document.getElementById('ps-firstPayout').value;
      const totalMonths = parseInt(document.getElementById('ps-totalMonths').value) || 0;
      const rent = parseFloat(document.getElementById('ps-rent').value) || 0;
      const insurance = parseFloat(document.getElementById('ps-insurance').value) || 0;
      const hcEnabled = document.getElementById('ps-hcToggle').checked;
      const hcAmount = hcEnabled ? (parseFloat(document.getElementById('ps-hcAmount').value) || 0) : 0;
      const containers = document.getElementById('ps-containers').value
        .split('\n').map(s => s.trim()).filter(Boolean);

      if (!clientName) { showMsg('ps-genError', 'Client name is required.', 'error'); return; }
      if (!firstPayoutStr) { showMsg('ps-genError', 'First payout date is required.', 'error'); return; }
      if (!totalMonths || totalMonths < 1) { showMsg('ps-genError', 'Total months must be at least 1.', 'error'); return; }
      if (!rent) { showMsg('ps-genError', 'Monthly rent must be greater than 0.', 'error'); return; }

      btn.disabled = true;
      btn.textContent = 'Generating...';

      const [y, m, d] = firstPayoutStr.split('-').map(Number);
      const startDate = new Date(y, m - 1, d);
      const cycle = startDate.getDate() <= 15 ? '15' : 'eom';
      const rerouted = selectedGroup ? !isNonReroutedClient(selectedGroup.row) : false;

      const { rows } = buildScheduleRows({
        startDate, cycle, totalMonths, rent, insurance, hcEnabled, hcAmount, containers, rerouted,
      });

      const pdfBytes = await buildPDF({ contractRef, rows });
      downloadPDF(pdfBytes, `Payment_Schedule_${contractRef.replace(/[^a-z0-9]/gi, '_')}.pdf`);
    } catch (ex) {
      showMsg('ps-genError', 'Error generating PDF: ' + ex.message, 'error');
      console.error(ex);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate PDF';
    }
  }

  function downloadPDF(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ───────────────────────────────────────────────────────────
  // PDF GENERATION — pdf-lib, matches LMC letterhead layout
  // ───────────────────────────────────────────────────────────
  const NAVY = () => PDFLib.rgb(0x11 / 255, 0x2f / 255, 0x56 / 255);
  const YELLOW = () => PDFLib.rgb(1, 0.92, 0.23);
  const GREY_TEXT = () => PDFLib.rgb(0.55, 0.55, 0.55);
  const BLACK = () => PDFLib.rgb(0, 0, 0);
  const WHITE = () => PDFLib.rgb(1, 1, 1);
  const LIGHT_BORDER = () => PDFLib.rgb(0.8, 0.8, 0.8);

  const PAGE_W = 595.28, PAGE_H = 841.89;
  const BAR_W = 34;
  const MARGIN_L = 100, MARGIN_R = 45;
  const TABLE_LEFT = MARGIN_L;
  const TABLE_RIGHT = PAGE_W - MARGIN_R;
  const TABLE_WIDTH = TABLE_RIGHT - TABLE_LEFT;
  const COL_CONTAINER = 130, COL_DATE = 85, COL_PAYMENT = 110, COL_DEDUCT_AMT = 65;
  const COL_DEDUCT_LABEL = TABLE_WIDTH - COL_CONTAINER - COL_DATE - COL_PAYMENT - COL_DEDUCT_AMT;
  const ROW_H = 15.5;
  const YEAR_BAR_H = 15.5;
  const TABLE_TOP_FIRST_PAGE = PAGE_H - 210;
  const TABLE_TOP_OTHER_PAGE = PAGE_H - 130;
  const BOTTOM_MARGIN = 90;

  async function fetchImageBytes(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) { return null; }
  }

  async function buildPDF({ contractRef, rows }) {
    const pdfDoc = await PDFLib.PDFDocument.create();
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

    const logoBytes = await fetchImageBytes(LOGO_URL);
    const logoImg = logoBytes ? await pdfDoc.embedPng(logoBytes) : null;

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let isFirstPage = true;
    let y = 0;

    function drawLeftBar(p) {
      p.drawRectangle({ x: 0, y: 0, width: BAR_W, height: PAGE_H, color: NAVY() });
      // chevron notch near top
      const notchTop = PAGE_H - 40;
      p.drawSvgPath(`M0,0 L${BAR_W},18 L0,36 Z`, { x: 0, y: notchTop, color: WHITE() });
    }

    function drawFooter(p) {
      const lineY = 70;
      p.drawLine({ start: { x: BAR_W + 30, y: lineY }, end: { x: BAR_W + 190, y: lineY }, thickness: 1, color: NAVY() });
      p.drawCircle({ x: BAR_W + 200, y: lineY, size: 3, color: NAVY() });
      p.drawCircle({ x: BAR_W + 214, y: lineY, size: 3, color: NAVY() });
      p.drawRectangle({ x: BAR_W + 222, y: lineY - 4, width: 14, height: 8, color: NAVY() });

      const addrX = PAGE_W - 220;
      let ay = lineY + 28;
      const addrLines = ['Office 310 SIT Tower', 'Dubai Silicon Oasis, Dubai UAE', 'info@legendmaritime.com', 'legendmaritime.com'];
      addrLines.forEach(line => {
        p.drawText(line, { x: addrX, y: ay, size: 8.5, font, color: GREY_TEXT() });
        ay -= 13;
      });
    }

    function drawHeader(p, showTitle) {
      if (logoImg) {
        const scale = 110 / logoImg.width;
        p.drawImage(logoImg, { x: BAR_W + 30, y: PAGE_H - 90, width: 110, height: logoImg.height * scale });
      } else {
        p.drawText('LEGEND MARITIME', { x: BAR_W + 30, y: PAGE_H - 60, size: 16, font: fontBold, color: NAVY() });
      }
      if (showTitle) {
        const title = `Payment Schedule for ${contractRef}`;
        const size = 13;
        const tw = fontBold.widthOfTextAtSize(title, size);
        const tx = (PAGE_W - tw) / 2;
        const ty = PAGE_H - 150;
        p.drawText(title, { x: tx, y: ty, size, font: fontBold, color: BLACK() });
        p.drawLine({ start: { x: tx, y: ty - 4 }, end: { x: tx + tw, y: ty - 4 }, thickness: 0.75, color: BLACK() });
      }
    }

    function drawTableHeader(p, topY) {
      p.drawRectangle({ x: TABLE_LEFT, y: topY - ROW_H, width: TABLE_WIDTH, height: ROW_H, color: YELLOW() });
      const heads = [
        ['Container numbers', TABLE_LEFT, COL_CONTAINER],
        ['Payout date', TABLE_LEFT + COL_CONTAINER, COL_DATE],
        ['Monthly Payment (AED)', TABLE_LEFT + COL_CONTAINER + COL_DATE, COL_PAYMENT],
        ['Deduction', TABLE_LEFT + COL_CONTAINER + COL_DATE + COL_PAYMENT, COL_DEDUCT_AMT + COL_DEDUCT_LABEL],
      ];
      heads.forEach(([label, x, w]) => {
        p.drawText(label, { x: x + 4, y: topY - ROW_H + 4.5, size: 8, font: fontBold, color: BLACK() });
      });
      let bx = TABLE_LEFT;
      [COL_CONTAINER, COL_DATE, COL_PAYMENT, COL_DEDUCT_AMT + COL_DEDUCT_LABEL].forEach(w => {
        p.drawRectangle({ x: bx, y: topY - ROW_H, width: w, height: ROW_H, borderColor: LIGHT_BORDER(), borderWidth: 0.5, color: undefined });
        bx += w;
      });
      return topY - ROW_H;
    }

    function drawYearBar(p, topY, label) {
      p.drawRectangle({ x: TABLE_LEFT, y: topY - YEAR_BAR_H, width: TABLE_WIDTH, height: YEAR_BAR_H, color: YELLOW() });
      const tw = fontBold.widthOfTextAtSize(label, 8);
      p.drawText(label, { x: TABLE_LEFT + (TABLE_WIDTH - tw) / 2, y: topY - YEAR_BAR_H + 4.5, size: 8, font: fontBold, color: BLACK() });
      return topY - YEAR_BAR_H;
    }

    function drawDataRow(p, topY, row) {
      const cols = [
        { text: row.container, w: COL_CONTAINER },
        { text: fmtDDMMYYYY(row.date), w: COL_DATE },
        { text: fmt2(row.monthlyPayment), w: COL_PAYMENT, align: 'right' },
        { text: row.deductionAmount ? fmt2(row.deductionAmount) : '', w: COL_DEDUCT_AMT, align: 'right' },
      ];
      let bx = TABLE_LEFT;
      cols.forEach(c => {
        p.drawRectangle({ x: bx, y: topY - ROW_H, width: c.w, height: ROW_H, borderColor: LIGHT_BORDER(), borderWidth: 0.5 });
        const tw = font.widthOfTextAtSize(c.text, 8);
        const tx = c.align === 'right' ? bx + c.w - tw - 4 : bx + 4;
        p.drawText(c.text, { x: tx, y: topY - ROW_H + 4.5, size: 8, font, color: BLACK() });
        bx += c.w;
      });
      // deduction label column (no border split needed beyond last box)
      p.drawRectangle({ x: bx, y: topY - ROW_H, width: COL_DEDUCT_LABEL, height: ROW_H, borderColor: LIGHT_BORDER(), borderWidth: 0.5 });
      if (row.deductionLabel) {
        p.drawText(row.deductionLabel, { x: bx + 4, y: topY - ROW_H + 4.5, size: 7.5, font, color: BLACK() });
      }
      return topY - ROW_H;
    }

    function fmt2(n) { return Math.round(n).toLocaleString(); }
    function fmtDDMMYYYY(d) {
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    }

    drawLeftBar(page);
    drawHeader(page, true);
    drawFooter(page);
    y = drawTableHeader(page, TABLE_TOP_FIRST_PAGE);

    let currentYearIdx = -1;
    const yearLabels = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', '7th Year', '8th Year'];

    for (const row of rows) {
      if (row.isYearStart) {
        currentYearIdx = row.yearIndex;
        if (y - YEAR_BAR_H < BOTTOM_MARGIN) {
          page = pdfDoc.addPage([PAGE_W, PAGE_H]);
          drawLeftBar(page);
          drawHeader(page, false);
          drawFooter(page);
          y = drawTableHeader(page, TABLE_TOP_OTHER_PAGE);
        }
        y = drawYearBar(page, y, yearLabels[currentYearIdx] || `Year ${currentYearIdx + 1}`);
      }
      if (y - ROW_H < BOTTOM_MARGIN) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        drawLeftBar(page);
        drawHeader(page, false);
        drawFooter(page);
        y = drawTableHeader(page, TABLE_TOP_OTHER_PAGE);
      }
      y = drawDataRow(page, y, row);
    }

    return pdfDoc.save();
  }

  return { init };
})();
