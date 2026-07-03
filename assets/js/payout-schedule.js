// ─────────────────────────────────────────────────────────────────
// PAYOUT SCHEDULE — payout-schedule.js
// Depends on: shared.js (parseDate, parseNumber, fmtDate, esc, buildEmailRecords,
//             lookupEmailRecord, splitEmails), app.js (parsePaymentSheet, readExcel)
// Generates a full multi-year Payment Schedule PDF for one client,
// matching the LMC letterhead template.
// ─────────────────────────────────────────────────────────────────

window.PayoutSchedule = (function () {

  const NEW_INSURANCE_FROM = new Date(2026, 5, 30); // 30 Jun 2026

  let scheduleRows  = [];   // parsed payment sheet rows (own copy, independent of Payout Generator)
  let clientGroups  = [];   // one entry per contract (a client can have several)
  let clientsByName = new Map(); // clientName -> [contractGroup, ...]
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
      <div class="card">
        <div class="ps-upload-split" style="margin-bottom:0;">
          <div>
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
          <div>
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
      </div>

      <div class="card" id="ps-clientCard" style="display:none;">
        <div class="section-label">Select Client <span class="optional-label">search by name or email</span></div>
        <div class="ps-search-wrap">
          <input type="text" id="ps-clientSearch" placeholder="Type client name or email to search..." autocomplete="off" />
        </div>
      </div>

      <div class="card" id="ps-contractCard" style="display:none;">
        <div class="section-label">Select Contract <span class="optional-label" id="ps-contractCount"></span></div>
        <div id="ps-contractList" class="ps-contract-list"></div>
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
      /* Tab truncation is now fixed at the root in global.css (widened
         .container from 900px to 1150px, giving the 7-tab bar enough room
         at its native 120px-min-width sizing). No override needed here. */

      .ps-search-wrap { position: relative; }
      .ps-search-wrap input[type="text"] {
        width: 100%; box-sizing: border-box; height: 42px; padding: 0 12px;
        border-radius: 8px; border: 1px solid #3a3f4b;
        background: #0f1218; color: #f0f0f0; font-size: 14px;
      }
      .ps-search-wrap input[type="text"]:focus { outline: 2px solid #4a7dfc; border-color: #4a7dfc; }

      .ps-dropdown {
        display: none; position: fixed; z-index: 9999;
        max-height: 260px; overflow-y: auto;
        background: #181c24; border: 1px solid #3a3f4b;
        border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      }
      .ps-dropdown.show { display: block; }
      .ps-dropdown-item {
        padding: 8px 12px; cursor: pointer; font-size: 13px;
        color: #f0f0f0; background: #181c24;
      }
      .ps-dropdown-item:hover, .ps-dropdown-item.active { background: #2a3550; color: #ffffff; }
      .ps-dropdown-empty { padding: 10px 12px; font-size: 13px; color: #8a8f9c; background: #181c24; }

      #ps-formCard input[type="text"], #ps-formCard input[type="date"],
      #ps-formCard input[type="number"], #ps-formCard textarea {
        width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px;
        border: 1px solid #3a3f4b; background: #0f1218;
        color: #f0f0f0; font-size: 13px; font-family: inherit;
      }
      #ps-formCard input:disabled { opacity: 0.5; }
      #ps-formCard textarea { resize: vertical; }
      .ps-checkbox-label { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; color: #f0f0f0; font-size: 13px; }
      .ps-checkbox-label input { width: auto; }

      .ps-contract-list { display: flex; flex-direction: column; gap: 8px; }
      .ps-contract-item {
        padding: 10px 14px; border-radius: 8px; border: 1px solid #3a3f4b;
        background: #0f1218; cursor: pointer;
      }
      .ps-contract-item:hover { border-color: #4a7dfc; }
      .ps-contract-item.active { border-color: #4a7dfc; background: #16223f; }
      .ps-contract-ref { font-size: 13px; font-weight: 600; color: #f0f0f0; }
      .ps-contract-containers { font-size: 11.5px; color: #8a8f9c; margin-top: 3px; }

      .ps-upload-split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      @media (max-width: 480px) { .ps-upload-split { grid-template-columns: 1fr; } }
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
    ensureDropdownEl();
    search.addEventListener('input', () => { positionDropdown(); renderDropdown(search.value); });
    search.addEventListener('focus', () => { positionDropdown(); renderDropdown(search.value); });
    window.addEventListener('resize', () => { if (isDropdownOpen()) positionDropdown(); });
    window.addEventListener('scroll', () => { if (isDropdownOpen()) positionDropdown(); }, true);
    document.addEventListener('click', e => {
      if (!e.target.closest('.ps-search-wrap') && !e.target.closest('#ps-clientDropdown')) {
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
      clientsByName = groupByName(clientGroups);
      document.getElementById('ps-fileLoaded').classList.add('show');
      document.getElementById('ps-loadedName').textContent = file.name;
      document.getElementById('ps-loadedMeta').textContent = `${clientsByName.size} clients, ${clientGroups.length} contracts found`;
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
      // One group per contract. If there's no contract number, fall back to
      // clientName + container so unrelated no-number rows for the same
      // client don't get merged into a single contract by mistake.
      const key = noNumber ? (r.clientName + '|' + (r.container || r.index)) : r.contractNo;
      if (!map.has(key)) {
        map.set(key, { key, clientName: r.clientName, contractNo: noNumber ? '' : r.contractNo, containers: [], row: r });
      }
      const g = map.get(key);
      if (r.container && !r.pinFilledDown && !g.containers.includes(r.container)) g.containers.push(r.container);
    });
    return Array.from(map.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }

  function groupByName(contractGroups) {
    const map = new Map();
    contractGroups.forEach(g => {
      if (!map.has(g.clientName)) map.set(g.clientName, []);
      map.get(g.clientName).push(g);
    });
    return map;
  }

  // ───────────────────────────────────────────────────────────
  // SEARCHABLE DROPDOWN (portaled to document.body to escape
  // any parent .card's overflow:hidden / transform clipping)
  // ───────────────────────────────────────────────────────────
  function ensureDropdownEl() {
    let dd = document.getElementById('ps-clientDropdown');
    if (!dd) {
      dd = document.createElement('div');
      dd.id = 'ps-clientDropdown';
      dd.className = 'ps-dropdown';
      document.body.appendChild(dd);
    }
    return dd;
  }

  function isDropdownOpen() {
    const dd = document.getElementById('ps-clientDropdown');
    return dd && dd.classList.contains('show');
  }

  function positionDropdown() {
    const input = document.getElementById('ps-clientSearch');
    const dd = document.getElementById('ps-clientDropdown');
    if (!input || !dd) return;
    const rect = input.getBoundingClientRect();
    dd.style.left = rect.left + 'px';
    dd.style.top = (rect.bottom + 4) + 'px';
    dd.style.width = rect.width + 'px';
  }

  function clientNameMatchesQuery(name, q) {
    if (name.toLowerCase().includes(q)) return true;
    if (emailRecords.length) {
      const rec = lookupEmailRecord(emailRecords, name);
      if (rec) {
        const [e1, e2] = splitEmails(rec.clientEmailRaw);
        if ((e1 && e1.toLowerCase().includes(q)) || (e2 && e2.toLowerCase().includes(q))) return true;
      }
    }
    return false;
  }

  function renderDropdown(query) {
    const dd = ensureDropdownEl();
    const q = (query || '').trim().toLowerCase();
    const names = Array.from(clientsByName.keys());
    const matches = (q ? names.filter(n => clientNameMatchesQuery(n, q)) : names).slice(0, 50);
    if (!matches.length) {
      dd.innerHTML = `<div class="ps-dropdown-empty">No matching clients</div>`;
    } else {
      dd.innerHTML = matches.map(name => {
        const contracts = clientsByName.get(name);
        const rec = emailRecords.length ? lookupEmailRecord(emailRecords, name) : null;
        const email = rec ? (splitEmails(rec.clientEmailRaw)[0] || '') : '';
        const contractTag = contracts.length > 1 ? ` <span style="color:#8a8f9c">(${contracts.length} contracts)</span>` : '';
        return `<div class="ps-dropdown-item" data-name="${esc(name)}">
          <div>${esc(name)}${contractTag}</div>
          ${email ? `<div style="font-size:11px;color:#8a8f9c;">${esc(email)}</div>` : ''}
        </div>`;
      }).join('');
      dd.querySelectorAll('.ps-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          onClientNameChosen(item.dataset.name);
          dd.classList.remove('show');
        });
      });
    }
    positionDropdown();
    dd.classList.add('show');
  }

  function onClientNameChosen(name) {
    const contracts = clientsByName.get(name) || [];
    document.getElementById('ps-clientSearch').value = name;
    if (contracts.length === 1) {
      hideContractCard();
      selectClient(contracts[0]);
    } else if (contracts.length > 1) {
      showContractCard(name, contracts);
    }
  }

  function showContractCard(name, contracts) {
    document.getElementById('ps-formCard').style.display = 'none';
    document.getElementById('ps-genCard').style.display = 'none';
    const card = document.getElementById('ps-contractCard');
    const list = document.getElementById('ps-contractList');
    document.getElementById('ps-contractCount').textContent = `${contracts.length} contracts for ${name}`;
    list.innerHTML = contracts.map(g => `
      <div class="ps-contract-item" data-key="${esc(g.key)}">
        <div class="ps-contract-ref">${esc(g.contractNo || '(no contract number)')}</div>
        <div class="ps-contract-containers">${g.containers.length ? esc(g.containers.join(', ')) : 'No containers listed'}</div>
      </div>
    `).join('');
    list.querySelectorAll('.ps-contract-item').forEach(item => {
      item.addEventListener('click', () => {
        const g = contracts.find(c => c.key === item.dataset.key);
        if (!g) return;
        list.querySelectorAll('.ps-contract-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        selectClient(g);
      });
    });
    card.style.display = 'block';
  }

  function hideContractCard() {
    document.getElementById('ps-contractCard').style.display = 'none';
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
    const containerCount = g.containers.length || 1;
    document.getElementById('ps-rent').value = (effRent || 0) * containerCount;
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
  function yearBlocks(totalMonths) {
    const blocks = [];
    if (totalMonths <= 0) return blocks;
    let remainder = totalMonths % 12;
    if (remainder === 0) remainder = 12;
    const first = Math.min(remainder, totalMonths);
    blocks.push(first);
    let remaining = totalMonths - first;
    while (remaining > 0) { const c = Math.min(12, remaining); blocks.push(c); remaining -= c; }
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

  function isNeverPaidDate(d) {
    if (!d) return false;
    const mo = d.getMonth() + 1, dy = d.getDate();
    return (mo === 3 && (dy === 15 || dy === 30)) || (mo === 4 && dy === 15);
  }

  // Non-rerouted: matches your original historical contract PDFs (CONAD0536,
  // CONAD1983, etc.) — Year 1/2/3 blocks, deduction on the first row of each.
  function buildNonReroutedRows(opts) {
    const { startDate, cycle, totalMonths, rent, insurance, hcEnabled, hcAmount, containers } = opts;
    const blocks = yearBlocks(totalMonths);
    const dates = generateDates(startDate, cycle, totalMonths);
    const out = [];
    let monthCursor = 0, containerCursor = 0;

    blocks.forEach((blockLen, yearIdx) => {
      for (let m = 0; m < blockLen; m++) {
        const isYearStart = m === 0;
        let deductionAmount = 0, deductionLabel = '';
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
          tripNumber: monthCursor + 1,
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

  // Rerouted: matches shared.js's calcDeduction — Y1/Y2/Y3 insurance timing
  // follows the ORIGINAL First Payout Date's calendar anniversary (or Payout
  // Restart Date only for the never-paid-batch exception: original first
  // payout on Mar 15, Mar 30, or Apr 15). Health Check applies at Y2/Y3 only.
  // If a deduction would make Monthly Payment negative, it's auto-split
  // across however many consecutive months keeps each payment >= 0.
  function buildReroutedRows(opts) {
    const { startDate, cycle, totalMonths, rent, insurance, hcEnabled, hcAmount, containers, dedBasis } = opts;
    const dates = generateDates(startDate, cycle, totalMonths);

    const y1 = new Date(dedBasis);
    const y2 = subtractOneMonth(addYears(dedBasis, 1));
    const y3 = addYears(dedBasis, 2);
    const sameMonth = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

    const out = dates.map((date, i) => ({
      tripNumber: i + 1,
      container: '',
      date,
      monthlyPayment: rent,
      deductionAmount: 0,
      deductionLabel: '',
    }));

    let containerCursor = 0;
    out.forEach(r => {
      if (containerCursor < containers.length) { r.container = containers[containerCursor]; containerCursor++; }
    });

    out.forEach((row, i) => {
      let amount = 0, label = '';
      if (sameMonth(row.date, y1)) { amount = insurance; label = 'IP'; }
      else if (sameMonth(row.date, y2) || sameMonth(row.date, y3)) {
        if (hcEnabled) { amount = insurance + hcAmount; label = 'IP & HC'; }
        else { amount = insurance; label = 'IP'; }
      }
      if (amount <= 0) return;
      const n = Math.max(1, Math.ceil(amount / rent));
      const share = amount / n;
      for (let k = 0; k < n && (i + k) < out.length; k++) {
        out[i + k].deductionAmount += share;
        out[i + k].monthlyPayment = rent - out[i + k].deductionAmount;
        out[i + k].deductionLabel = label;
      }
    });

    return { rows: out, blocks: null };
  }

  function buildScheduleRows(opts) {
    return opts.rerouted ? buildReroutedRows(opts) : buildNonReroutedRows(opts);
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

      // Deduction anniversary basis: original First Payout Date, except the
      // never-paid-batch exception which uses Payout Restart Date instead.
      let dedBasis = startDate;
      if (rerouted && selectedGroup) {
        const origFirstPayout = selectedGroup.row.firstPayout;
        const restart = selectedGroup.row.restartDate;
        dedBasis = (origFirstPayout && isNeverPaidDate(origFirstPayout)) ? (restart || startDate) : (origFirstPayout || startDate);
      }

      const { rows, blocks } = buildScheduleRows({
        startDate, cycle, totalMonths, rent, insurance, hcEnabled, hcAmount, containers, rerouted, dedBasis,
      });

      const pdfBytes = await buildPDF({ clientName, rows, blocks, rerouted });
      downloadPDF(pdfBytes, `Payout_Schedule_${clientName.replace(/[^a-z0-9]/gi, '_')}_${contractRef.replace(/[^a-z0-9]/gi, '_')}.pdf`);
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
  const YELLOW = () => PDFLib.rgb(1, 0.92, 0.23);
  const WHITE = () => PDFLib.rgb(1, 1, 1);
  const BLACK = () => PDFLib.rgb(0, 0, 0);
  const LIGHT_BORDER = () => PDFLib.rgb(0, 0, 0);

  const LETTERHEAD_URL = '/assets/lmc_letterhead.pdf';

  const MARGIN_L = 60, MARGIN_R = 20;
  const COL_CONTAINER = 105, COL_TRIP = 42, COL_DATE = 70, COL_PAYMENT = 95, COL_DEDUCT_AMT = 55;
  const ROW_H = 18;
  const YEAR_BAR_H = 18;
  const TABLE_TOP_FIRST_PAGE_OFFSET = 126; // distance from top of page to first table row
  const TABLE_TOP_OTHER_PAGE_OFFSET = 130;
  const BOTTOM_MARGIN = 90;

  async function fetchBytes(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async function buildPDF({ clientName, rows, blocks, rerouted }) {
    const pdfDoc = await PDFLib.PDFDocument.create();
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

    // Use the real LMC letterhead PDF as the background template on every page
    const letterheadBytes = await fetchBytes(LETTERHEAD_URL);
    const [letterheadPage] = await pdfDoc.embedPdf(letterheadBytes, [0]);
    const PAGE_W = letterheadPage.width;
    const PAGE_H = letterheadPage.height;

    // Rerouted schedules get a Trip No. column; non-rerouted match the
    // original historical contract PDF layout (no Trip No. column).
    const cols = rerouted
      ? [['Container numbers', COL_CONTAINER], ['Trip No.', COL_TRIP], ['Payout date', COL_DATE], ['Monthly Payment (AED)', COL_PAYMENT], ['Deduction', COL_DEDUCT_AMT]]
      : [['Container numbers', COL_CONTAINER], ['Payout date', COL_DATE], ['Monthly Payment (AED)', COL_PAYMENT], ['Deduction', COL_DEDUCT_AMT]];
    const BORDERED_WIDTH = cols.reduce((s, c) => s + c[1], 0);
    // Center the table (bordered columns + the unboxed deduction-label zone)
    // within the printable width, instead of left-anchoring it at the margin
    // and leaving a big blank gap on the right.
    const longestLabel = rerouted ? 'IP & HC' : 'Insurance Premium & Health Check';
    const labelReserve = font.widthOfTextAtSize(longestLabel, 7.5) + 16;
    const availableWidth = PAGE_W - MARGIN_L - MARGIN_R;
    const blockWidth = BORDERED_WIDTH + 8 + labelReserve;
    const TABLE_LEFT = MARGIN_L + Math.max(0, (availableWidth - blockWidth) / 2);
    const LABEL_X = TABLE_LEFT + BORDERED_WIDTH + 8;
    const FULL_BAR_WIDTH = (PAGE_W - MARGIN_R) - TABLE_LEFT;
    const TABLE_TOP_FIRST_PAGE = PAGE_H - TABLE_TOP_FIRST_PAGE_OFFSET;
    const TABLE_TOP_OTHER_PAGE = PAGE_H - TABLE_TOP_OTHER_PAGE_OFFSET;

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = 0;

    function drawLetterhead(p) {
      p.drawPage(letterheadPage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
    }

    function drawTitle(p) {
      const title = `Payout Schedule for ${clientName}`;
      const size = 13;
      const tw = fontBold.widthOfTextAtSize(title, size);
      const tx = (PAGE_W - tw) / 2;
      const ty = PAGE_H - 106;
      p.drawText(title, { x: tx, y: ty, size, font: fontBold, color: BLACK() });
      p.drawLine({ start: { x: tx, y: ty - 4 }, end: { x: tx + tw, y: ty - 4 }, thickness: 0.75, color: BLACK() });
    }

    function drawTableHeader(p, topY) {
      // Opaque white first so the letterhead's faint watermark logo
      // doesn't show through the table — full width including the
      // unboxed label float zone.
      p.drawRectangle({ x: TABLE_LEFT, y: topY - ROW_H, width: FULL_BAR_WIDTH, height: ROW_H, color: WHITE() });
      // Yellow header only spans the bordered columns — not the unboxed
      // label float zone — so "Deduction" doesn't look like it's floating
      // in a mostly-empty bar.
      p.drawRectangle({ x: TABLE_LEFT, y: topY - ROW_H, width: BORDERED_WIDTH, height: ROW_H, color: YELLOW() });
      let bx = TABLE_LEFT;
      cols.forEach(([label, w]) => {
        p.drawRectangle({ x: bx, y: topY - ROW_H, width: w, height: ROW_H, borderColor: LIGHT_BORDER(), borderWidth: 0.75 });
        p.drawText(label, { x: bx + 3, y: topY - ROW_H + 4, size: 7, font: fontBold, color: BLACK() });
        bx += w;
      });
      return topY - ROW_H;
    }

    function drawYearBar(p, topY, label) {
      p.drawRectangle({ x: TABLE_LEFT, y: topY - YEAR_BAR_H, width: FULL_BAR_WIDTH, height: YEAR_BAR_H, color: YELLOW() });
      const tw = fontBold.widthOfTextAtSize(label, 8);
      p.drawText(label, { x: TABLE_LEFT + (BORDERED_WIDTH - tw) / 2, y: topY - YEAR_BAR_H + 4, size: 8, font: fontBold, color: BLACK() });
      return topY - YEAR_BAR_H;
    }

    const LABEL_MAX_WIDTH = (PAGE_W - MARGIN_R) - LABEL_X - 4;
    const LABEL_LINE_H = 9;

    function wrapText(text, maxWidth, fnt, size) {
      const words = text.split(' ');
      const lines = [];
      let current = '';
      words.forEach(w => {
        const test = current ? current + ' ' + w : w;
        if (fnt.widthOfTextAtSize(test, size) > maxWidth && current) {
          lines.push(current);
          current = w;
        } else {
          current = test;
        }
      });
      if (current) lines.push(current);
      return lines;
    }

    function rowHeightFor(row) {
      if (!row.deductionLabel) return ROW_H;
      const lines = wrapText(row.deductionLabel, LABEL_MAX_WIDTH, font, 7.5);
      return Math.max(ROW_H, lines.length * LABEL_LINE_H + 8);
    }

    function drawDataRow(p, topY, row) {
      const rh = rowHeightFor(row);
      p.drawRectangle({ x: TABLE_LEFT, y: topY - rh, width: FULL_BAR_WIDTH, height: rh, color: WHITE() });
      const cells = rerouted
        ? [
            { text: row.container, w: COL_CONTAINER },
            { text: String(row.tripNumber), w: COL_TRIP, align: 'center' },
            { text: fmtDDMMYYYY(row.date), w: COL_DATE },
            { text: fmt2(row.monthlyPayment), w: COL_PAYMENT, align: 'right' },
            { text: row.deductionAmount ? fmt2(row.deductionAmount) : '', w: COL_DEDUCT_AMT, align: 'right' },
          ]
        : [
            { text: row.container, w: COL_CONTAINER },
            { text: fmtDDMMYYYY(row.date), w: COL_DATE },
            { text: fmt2(row.monthlyPayment), w: COL_PAYMENT, align: 'right' },
            { text: row.deductionAmount ? fmt2(row.deductionAmount) : '', w: COL_DEDUCT_AMT, align: 'right' },
          ];
      const textY = topY - rh / 2 - 2.6; // vertically center single-line cell text
      let bx = TABLE_LEFT;
      cells.forEach(c => {
        p.drawRectangle({ x: bx, y: topY - rh, width: c.w, height: rh, borderColor: LIGHT_BORDER(), borderWidth: 0.75 });
        const tw = font.widthOfTextAtSize(c.text, 7.5);
        let tx = bx + 3;
        if (c.align === 'right') tx = bx + c.w - tw - 3;
        else if (c.align === 'center') tx = bx + (c.w - tw) / 2;
        p.drawText(c.text, { x: tx, y: textY, size: 7.5, font, color: BLACK() });
        bx += c.w;
      });
      if (row.deductionLabel) {
        const lines = wrapText(row.deductionLabel, LABEL_MAX_WIDTH, font, 7.5);
        const blockH = lines.length * LABEL_LINE_H;
        let ly = topY - (rh - blockH) / 2 - LABEL_LINE_H + 2.6;
        lines.forEach(line => {
          p.drawText(line, { x: LABEL_X, y: ly, size: 7.5, font, color: BLACK() });
          ly -= LABEL_LINE_H;
        });
      }
      return topY - rh;
    }

    function fmt2(n) { return Math.round(n).toLocaleString(); }
    function fmtDDMMYYYY(d) {
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    }

    drawLetterhead(page);
    drawTitle(page);
    y = drawTableHeader(page, TABLE_TOP_FIRST_PAGE);

    let currentYearIdx = -1;
    const yearLabels = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', '7th Year', '8th Year'];

    for (const row of rows) {
      if (row.isYearStart && !rerouted) {
        currentYearIdx = row.yearIndex;
        if (y - YEAR_BAR_H < BOTTOM_MARGIN) {
          page = pdfDoc.addPage([PAGE_W, PAGE_H]);
          drawLetterhead(page);
          y = drawTableHeader(page, TABLE_TOP_OTHER_PAGE);
        }
        y = drawYearBar(page, y, yearLabels[currentYearIdx] || `Year ${currentYearIdx + 1}`);
      }
      const rh = rowHeightFor(row);
      if (y - rh < BOTTOM_MARGIN) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        drawLetterhead(page);
        y = drawTableHeader(page, TABLE_TOP_OTHER_PAGE);
      }
      y = drawDataRow(page, y, row);
    }

    return pdfDoc.save();
  }

  return { init };
})();
