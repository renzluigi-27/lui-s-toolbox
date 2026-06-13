/* ─────────────────────────────────────────────────────────────────
   CONTAINER TRIP UPDATER
   Standalone module — mounts into #tripMount via ContainerTripUpdater.init()
───────────────────────────────────────────────────────────────── */

window.ContainerTripUpdater = (function () {

  const TRIPS = {
    'shanghai|new york':         { transit: 30, tenure: 35, free: 3 },
    'new york|shanghai':         { transit: 30, tenure: 35, free: 3 },
    'shanghai|rotterdam':        { transit: 40, tenure: 48, free: 3 },
    'rotterdam|shanghai':        { transit: 50, tenure: 60, free: 3 },
    'shanghai|lagos':            { transit: 35, tenure: 43, free: 3 },
    'lagos|ho chi minh':         { transit: 50, tenure: 60, free: 5 },
    'ho chi minh|hamburg':       { transit: 50, tenure: 60, free: 3 },
    'hamburg|yokohama':          { transit: 30, tenure: 35, free: 3 },
    'yokohama|santos':           { transit: 35, tenure: 43, free: 3 },
    'santos|shanghai':           { transit: 45, tenure: 52, free: 10 },
    'shanghai|manzanillo (mx)':  { transit: 20, tenure: 25, free: 3 },
    'manzanillo (mx)|shanghai':  { transit: 20, tenure: 25, free: 3 },
    'shanghai|los angeles':      { transit: 15, tenure: 15, free: 3 },
    'los angeles|yokohama':      { transit: 12, tenure: 12, free: 3 },
  };

  const PORT_SEQUENCE = [
    ['shanghai', 'new york'],
    ['new york', 'shanghai'],
    ['shanghai', 'rotterdam'],
    ['rotterdam', 'shanghai'],
    ['shanghai', 'lagos'],
    ['lagos', 'ho chi minh'],
    ['ho chi minh', 'hamburg'],
    ['hamburg', 'yokohama'],
    ['yokohama', 'santos'],
    ['santos', 'shanghai'],
    ['shanghai', 'manzanillo (mx)'],
    ['manzanillo (mx)', 'shanghai'],
    ['shanghai', 'los angeles'],
    ['los angeles', 'yokohama'],
  ];

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  let inited = false;
  let rerouteData = null;
  let tripsLoaded = false;
  let calYear, calMonth, selYear, selMonth, selDay;
  let mountId = '';

  // ── Helpers ──────────────────────────────────────────────────

  function getRoute(tripNum) {
    return PORT_SEQUENCE[(tripNum - 1) % PORT_SEQUENCE.length];
  }

  function excelSerial(v) {
    if (v instanceof Date) return v;
    if (typeof v === 'number' && v > 1000) {
      const d = new Date(1899, 11, 30);
      d.setDate(d.getDate() + Math.floor(v));
      return d;
    }
    if (typeof v === 'string') {
      const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
    }
    return null;
  }

  function fmtDate(d) {
    if (!d) return '—';
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  }

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function capitalize(s) {
    return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function q(sel) {
    return document.getElementById(mountId).querySelector(sel);
  }

  // ── Calendar ─────────────────────────────────────────────────

  function renderCal() {
    const grid = q('#ctu-cal-grid');
    if (!grid) return;
    q('#ctu-month-label').textContent = `${MONTHS[calMonth]} ${calYear}`;
    grid.innerHTML = '';

    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
      const el = document.createElement('div');
      el.textContent = d;
      el.className = 'ctu-cal-dn';
      grid.appendChild(el);
    });

    const today = new Date();
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const prevDays = new Date(calYear, calMonth, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement('div');
      el.textContent = prevDays - firstDay + 1 + i;
      el.className = 'ctu-cal-d ctu-cal-other';
      grid.appendChild(el);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const el = document.createElement('div');
      el.textContent = d;
      const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
      const isSel   = d === selDay && calMonth === selMonth && calYear === selYear;
      el.className = 'ctu-cal-d' + (isSel ? ' ctu-cal-sel' : isToday ? ' ctu-cal-today' : '');
      el.addEventListener('click', () => {
        selYear = calYear; selMonth = calMonth; selDay = d;
        updateSelLabel();
        renderCal();
      });
      grid.appendChild(el);
    }

    updateSelLabel();
  }

  function updateSelLabel() {
    const el = q('#ctu-sel-label');
    if (el) el.textContent = fmtDate(new Date(selYear, selMonth, selDay));
  }

  // ── Upload ────────────────────────────────────────────────────

  function setupUpload(inputId, zoneId, loadedId, loadedNameId, onLoad) {
    const mount  = document.getElementById(mountId);
    const input  = mount.querySelector(`#${inputId}`);
    const zone   = mount.querySelector(`#${zoneId}`);
    const loaded = mount.querySelector(`#${loadedId}`);
    const lname  = mount.querySelector(`#${loadedNameId}`);

    if (!input || !zone) return;

    input.addEventListener('change', e => handleFile(e.target.files[0]));
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });

    function handleFile(file) {
      if (!file) return;
      if (lname) lname.textContent = file.name;
      if (loaded) loaded.classList.add('show');
      const reader = new FileReader();
      reader.onload = ev => onLoad(ev.target.result);
      reader.readAsArrayBuffer(file);
    }
  }

  // ── Check ready ───────────────────────────────────────────────

  function checkReady() {
    const btn  = q('#ctu-find-btn');
    const hint = q('#ctu-find-hint');
    if (!btn) return;
    const ready = rerouteData && tripsLoaded;
    btn.disabled = !ready;
    if (ready) {
      hint.textContent = '';
    } else if (!rerouteData && !tripsLoaded) {
      hint.textContent = 'Upload both files to continue';
    } else if (!rerouteData) {
      hint.textContent = 'Upload container trips file';
    } else {
      hint.textContent = 'Upload trips sheet file';
    }
  }

  // ── Find containers ───────────────────────────────────────────

  function findContainers() {
    const target = new Date(selYear, selMonth, selDay);
    const results = [];

    for (const row of rerouteData) {
      if (!row[0]) continue;
      const container     = String(row[0]).trim();
      const containerType = row[8] || '';

      const newStart = excelSerial(row[2]);
      if (newStart &&
          newStart.getFullYear() === target.getFullYear() &&
          newStart.getMonth()    === target.getMonth() &&
          newStart.getDate()     === target.getDate()) {
        results.push({ container, containerType, tripNum: 1, startDate: newStart, endDate: excelSerial(row[4]) });
      }

      for (let i = 9; i < row.length; i += 3) {
        const sd = excelSerial(row[i]);
        if (!sd) continue;
        if (sd.getFullYear() === target.getFullYear() &&
            sd.getMonth()    === target.getMonth() &&
            sd.getDate()     === target.getDate()) {
          const tripNum = ((i - 9) / 3) + 2;
          results.push({ container, containerType, tripNum, startDate: sd, endDate: excelSerial(row[i + 2]) || null });
        }
      }
    }

    renderResults(results, target);
  }

  // ── Render results ────────────────────────────────────────────

  function updateCount() {
    const grid    = q('#ctu-cards-grid');
    const titleEl = q('#ctu-results-title');
    const resCard = q('#ctu-results-card');
    if (!grid || !titleEl || !resCard) return;
    const remaining = grid.children.length;
    if (remaining === 0) {
      resCard.style.display = 'none';
    } else {
      const m = titleEl.textContent.match(/on (.+)$/);
      const dateStr = m ? m[1] : '';
      titleEl.textContent = `${remaining} container${remaining > 1 ? 's' : ''} to update on ${dateStr}`;
    }
  }

  function renderResults(results, targetDate) {
    const resCard = q('#ctu-results-card');
    const title   = q('#ctu-results-title');
    const grid    = q('#ctu-cards-grid');
    const msg     = q('#ctu-msg-error');

    msg.className = 'msg';
    msg.textContent = '';

    if (results.length === 0) {
      msg.className = 'msg error show';
      msg.textContent = `No containers found for ${fmtDate(targetDate)}.`;
      resCard.style.display = 'none';
      return;
    }

    title.textContent = `${results.length} container${results.length > 1 ? 's' : ''} to update on ${fmtDate(targetDate)}`;
    grid.innerHTML = '';

    for (const r of results) {
      const [startPort, endPort] = getRoute(r.tripNum);
      const key     = `${startPort}|${endPort}`;
      const trip    = TRIPS[key] || {};
      const transit = trip.transit || '—';
      const tenure  = trip.tenure  || '—';
      const free    = trip.free    || 0;

      let tripEnd = r.endDate;
      if (!tripEnd && trip.tenure) tripEnd = addDays(r.startDate, trip.tenure);
      const nextStart = tripEnd ? addDays(tripEnd, free) : null;

      const el = document.createElement('div');
      el.className = 'card';
      el.style.marginBottom = '0';
      el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:13px;font-weight:500;color:var(--liq-text);">${esc(r.container)}</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:11px;padding:3px 8px;border-radius:8px;background:rgba(255,255,255,0.08);color:var(--liq-text-muted);">${esc(r.containerType)}</span>
            <button class="ctu-clear-btn" title="Clear">✕</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;">
          <span style="font-size:13px;font-weight:500;color:var(--liq-text);">${capitalize(startPort)}</span>
          <span style="font-size:13px;color:var(--liq-text-hint);">→</span>
          <span style="font-size:13px;font-weight:500;color:var(--liq-text);">${capitalize(endPort)}</span>
        </div>
        <div style="border-top:0.5px solid rgba(255,255,255,0.1);margin:10px 0;"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div><div style="font-size:11px;color:var(--liq-text-hint);margin-bottom:3px;">Date</div><div style="font-size:14px;font-weight:500;color:var(--liq-text);">${fmtDate(r.startDate)}</div></div>
          <div><div style="font-size:11px;color:var(--liq-text-hint);margin-bottom:3px;">Number of days</div><div style="font-size:14px;font-weight:500;color:var(--liq-text);">${transit}</div></div>
          <div style="margin-top:6px;"><div style="font-size:11px;color:var(--liq-text-hint);margin-bottom:3px;">Total trip tenure</div><div style="font-size:14px;font-weight:500;color:var(--liq-text);">${tenure} days</div></div>
          <div style="margin-top:6px;"><div style="font-size:11px;color:var(--liq-text-hint);margin-bottom:3px;">Trip end date</div><div style="font-size:14px;font-weight:500;color:var(--liq-text);">${fmtDate(tripEnd)}</div></div>
        </div>
        <div style="margin-top:10px;padding:8px 10px;background:rgba(255,255,255,0.06);border-radius:8px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:11px;color:var(--liq-text-hint);">Next trip start date</span>
          <span style="font-size:13px;font-weight:500;color:var(--liq-text);">${fmtDate(nextStart)}</span>
        </div>`;

      el.querySelector('.ctu-clear-btn').addEventListener('click', () => {
        el.remove();
        updateCount();
      });

      grid.appendChild(el);
    }

    resCard.style.display = 'block';
  }

  // ── Build UI ──────────────────────────────────────────────────

  function buildUI() {
    const mount = document.getElementById(mountId);
    mount.innerHTML = `
      <style>
        .ctu-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
        .ctu-cal-dn   { font-size:11px; color:var(--liq-text-hint); text-align:center; padding:6px 0; font-weight:500; }
        .ctu-cal-d    { height:44px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:14px; color:var(--liq-text-muted); cursor:pointer; }
        .ctu-cal-d:hover { background:rgba(255,255,255,0.08); }
        .ctu-cal-sel  { background:rgba(255,255,255,0.9) !important; color:#0d0c18 !important; font-weight:500; }
        .ctu-cal-today{ border:0.5px solid rgba(255,255,255,0.3); color:var(--liq-text) !important; font-weight:500; }
        .ctu-cal-other{ color:rgba(180,165,255,0.25) !important; cursor:default; }
        .ctu-cal-other:hover { background:transparent !important; }
        .ctu-nav-btn  { width:28px; height:28px; border-radius:8px; border:0.5px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06); color:var(--liq-text-muted); font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .ctu-clear-btn{ width:22px; height:22px; border-radius:6px; border:0.5px solid rgba(255,100,100,0.3); background:rgba(255,80,80,0.1); color:rgba(255,130,130,0.8); font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1; font-family:var(--font-sans); }
        .ctu-clear-btn:hover { background:rgba(255,80,80,0.22); }
      </style>

      <!-- Upload card -->
      <div class="card">
        <div class="section-label">Upload files</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--liq-text-hint);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Container Trips</div>
            <div class="upload-zone upload-zone-sm" id="ctu-zone-reroute">
              <input type="file" accept=".xlsx,.xls" id="ctu-input-reroute">
              <div class="upload-zone-text">
                <strong>Choose file</strong>
                <span>container_trips.xlsx</span>
              </div>
            </div>
            <div class="file-loaded" id="ctu-loaded-reroute">
              <span>✓</span>
              <span class="file-loaded-name" id="ctu-loaded-reroute-name"></span>
            </div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--liq-text-hint);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Trips Sheet</div>
            <div class="upload-zone upload-zone-sm" id="ctu-zone-trips">
              <input type="file" accept=".xlsx,.xls" id="ctu-input-trips">
              <div class="upload-zone-text">
                <strong>Choose file</strong>
                <span>trips_sheet.xlsx</span>
              </div>
            </div>
            <div class="file-loaded" id="ctu-loaded-trips">
              <span>✓</span>
              <span class="file-loaded-name" id="ctu-loaded-trips-name"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Calendar card -->
      <div class="card">
        <div class="section-label">Select date</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span id="ctu-month-label" style="font-size:14px;font-weight:500;color:var(--liq-text);"></span>
          <div style="display:flex;gap:4px;">
            <button class="ctu-nav-btn" id="ctu-cal-prev">‹</button>
            <button class="ctu-nav-btn" id="ctu-cal-next">›</button>
          </div>
        </div>
        <div id="ctu-cal-grid" class="ctu-cal-grid"></div>
        <div style="margin-top:10px;font-size:13px;color:var(--liq-text-muted);">
          Selected: <span id="ctu-sel-label" style="font-weight:500;color:var(--liq-text);"></span>
        </div>
        <div class="btn-row">
          <button class="btn-primary" id="ctu-find-btn" disabled>Find containers</button>
          <span class="generate-hint" id="ctu-find-hint">Upload both files to continue</span>
        </div>
        <div class="msg" id="ctu-msg-error"></div>
      </div>

      <!-- Results card -->
      <div class="card" id="ctu-results-card" style="display:none;">
        <div class="results-header">
          <span class="results-title" id="ctu-results-title"></span>
        </div>
        <div id="ctu-cards-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;"></div>
      </div>`;
  }

  // ── Init ──────────────────────────────────────────────────────

  function init(id) {
    if (inited) return;
    inited = true;
    mountId = id;

    const today = new Date();
    calYear  = today.getFullYear();
    calMonth = today.getMonth();
    selYear  = today.getFullYear();
    selMonth = today.getMonth();
    selDay   = today.getDate();

    buildUI();
    renderCal();

    q('#ctu-cal-prev').addEventListener('click', () => {
      calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCal();
    });
    q('#ctu-cal-next').addEventListener('click', () => {
      calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCal();
    });

    setupUpload('ctu-input-reroute', 'ctu-zone-reroute', 'ctu-loaded-reroute', 'ctu-loaded-reroute-name', (buf) => {
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rerouteData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }).slice(1);
      checkReady();
    });

    setupUpload('ctu-input-trips', 'ctu-zone-trips', 'ctu-loaded-trips', 'ctu-loaded-trips-name', (buf) => {
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      for (const r of rows.slice(1)) {
        if (!r[0] || !r[1]) continue;
        const k = `${String(r[0]).trim().toLowerCase()}|${String(r[1]).trim().toLowerCase()}`;
        TRIPS[k] = { transit: r[4], tenure: r[9], free: r[5] };
      }
      tripsLoaded = true;
      checkReady();
    });

    q('#ctu-find-btn').addEventListener('click', findContainers);
  }

  return { init };

})();
