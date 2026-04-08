  let emailSheetData = null;
  let clientListData = null;
  let results = [];
  const PREFIXES = /^(mr\.?|mrs\.?|ms\.?|dr\.?|miss\.?)\s+/gi;

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }));
        } catch(err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  document.getElementById('emailSheetInput').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    emailSheetData = await readFile(file);
    document.getElementById('emailSheetCard').classList.add('has-file');
    const nm = document.getElementById('emailSheetName');
    nm.textContent = '\u2713 ' + file.name; nm.style.display = 'block';
    checkReady();
  });

  document.getElementById('clientListInput').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    clientListData = await readFile(file);
    document.getElementById('clientListCard').classList.add('has-file');
    const nm = document.getElementById('clientListName');
    nm.textContent = '\u2713 ' + file.name; nm.style.display = 'block';
    checkReady();
  });

  ['emailSheetCard','clientListCard'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', async e => {
      e.preventDefault(); el.classList.remove('dragover');
      const file = e.dataTransfer.files[0]; if (!file) return;
      const inputId = id === 'emailSheetCard' ? 'emailSheetInput' : 'clientListInput';
      const dt = new DataTransfer(); dt.items.add(file);
      document.getElementById(inputId).files = dt.files;
      document.getElementById(inputId).dispatchEvent(new Event('change'));
    });
  });

  function checkReady() {
    if (emailSheetData && clientListData) {
      buildConfig();
      document.getElementById('runBtn').disabled = false;
    }
  }

  function buildConfig() {
    const esH = emailSheetData[0] || [], clH = clientListData[0] || [];
    document.getElementById('configSection').classList.add('visible');
    document.getElementById('configGrid').innerHTML =
      '<div class="config-group"><label>Email Sheet \u2014 Name</label><select id="esName">' + opts(esH, autoDetect(esH,['name','client'])) + '</select></div>' +
      '<div class="config-group"><label>Email Sheet \u2014 Email</label><select id="esEmail">' + opts(esH, autoDetect(esH,['email','mail'])) + '</select></div>' +
      '<div class="config-group"><label>Client List \u2014 Name</label><select id="clName">' + opts(clH, autoDetect(clH,['name','client'])) + '</select></div>';
  }

  function autoDetect(headers, kw) {
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i]).toLowerCase();
      if (kw.some(k => h.includes(k))) return i;
    }
    return 0;
  }

  function opts(headers, def) {
    return headers.map((h, i) => '<option value="' + i + '"' + (i===def?' selected':'') + '>' + (h || 'Column '+(i+1)) + '</option>').join('');
  }

  function normalize(name) {
    return String(name || '').replace(PREFIXES, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function dedup(name) {
    const parts = name.split(' '), seen = [];
    for (const w of parts) if (!seen.includes(w)) seen.push(w);
    return seen.join(' ');
  }

  function extractNames(raw) {
    const m = raw.match(/\(([^)]+)\)/);
    const main = raw.replace(/\([^)]*\)/g, '').trim();
    const names = [dedup(normalize(main))];
    if (m) names.push(dedup(normalize(m[1])));
    return names;
  }

  function isMatch(query, sheet) {
    if (!query || !sheet) return false;
    const qp = query.split(' ').filter(Boolean);
    const sp = sheet.split(' ').filter(Boolean);
    return qp.every(q => sp.some(s => s === q));
  }

  function runMatcher() {
    hideError();
    const esNi = parseInt(document.getElementById('esName').value);
    const esEi = parseInt(document.getElementById('esEmail').value);
    const clNi = parseInt(document.getElementById('clName').value);

    const sheetRows = emailSheetData.slice(1).map(r => ({
      rawName: String(r[esNi] || '').trim(),
      email: String(r[esEi] || '').trim().toLowerCase(),
      norm: dedup(normalize(String(r[esNi] || '')))
    })).filter(r => r.rawName);

    const clients = clientListData.slice(1).map(r => String(r[clNi] || '').trim()).filter(Boolean);

    if (!sheetRows.length) { showError('Email Sheet is empty or column mapping is wrong.'); return; }
    if (!clients.length) { showError('Client List is empty or column mapping is wrong.'); return; }

    results = [];
    let confirmed = 0, multiple = 0, noMatch = 0;

    for (const name of clients) {
      const queries = extractNames(name);
      const matched = [];
      for (const q of queries) {
        for (const sr of sheetRows) {
          if (isMatch(q, sr.norm) && !matched.find(r => r.rawName === sr.rawName && r.email === sr.email)) {
            matched.push(sr);
          }
        }
      }
      const emails = [...new Set(matched.map(r => r.email).filter(Boolean))];
      const sheetNames = [...new Set(matched.map(r => r.rawName))];
      const row = { clientName: name, sheetNames, confirmedEmail: '', potentialEmails: [] };
      if (emails.length === 1) { row.confirmedEmail = emails[0]; confirmed++; }
      else if (emails.length > 1) { row.potentialEmails = emails; multiple++; }
      else noMatch++;
      results.push(row);
    }

    document.getElementById('statTotal').textContent = results.length;
    document.getElementById('statConfirmed').textContent = confirmed;
    document.getElementById('statMultiple').textContent = multiple;
    document.getElementById('statNomatch').textContent = noMatch;
    document.getElementById('statsBar').classList.add('visible');

    const maxP = Math.max(0, ...results.map(r => r.potentialEmails.length));
    let hHTML = '<tr><th>#</th><th>Client Name (Input)</th><th>Client Name (Email Sheet)</th><th>Status</th><th>Confirmed Email</th>';
    for (let i = 1; i <= maxP; i++) hHTML += '<th>Potential Email ' + i + '</th>';
    hHTML += '</tr>';
    document.getElementById('tableHead').innerHTML = hHTML;

    let bHTML = '';
    results.forEach((r, i) => {
      let badge;
      if (r.confirmedEmail) badge = '<span class="badge badge-valid"><span class="badge-dot"></span>Confirmed</span>';
      else if (r.potentialEmails.length) badge = '<span class="badge badge-warn"><span class="badge-dot"></span>' + r.potentialEmails.length + ' found</span>';
      else badge = '<span class="badge badge-invalid"><span class="badge-dot"></span>No match</span>';
      bHTML += '<tr><td class="mono">' + (i+1) + '</td><td class="name-col">' + esc(r.clientName) + '</td><td class="name-col" style="color:var(--text-muted);font-weight:400">' + (r.sheetNames.length ? r.sheetNames.map(esc).join('<br>') : '\u2014') + '</td><td>' + badge + '</td><td class="email-confirmed">' + esc(r.confirmedEmail) + '</td>';
      for (let j = 0; j < maxP; j++) bHTML += '<td><span class="email-potential">' + (r.potentialEmails[j] ? esc(r.potentialEmails[j]) : '') + '</span></td>';
      bHTML += '</tr>';
    });
    document.getElementById('tableBody').innerHTML = bHTML;
    document.getElementById('resultsBar').classList.add('visible');
    document.getElementById('tableWrap').classList.add('visible');
  }

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function showError(msg) { const e = document.getElementById('errorBanner'); e.textContent = '\u26a0 ' + msg; e.classList.add('visible'); }
  function hideError() { document.getElementById('errorBanner').classList.remove('visible'); }

  function exportCSV() {
    if (!results.length) return;
    const maxP = Math.max(0, ...results.map(r => r.potentialEmails.length));
    const headers = ['Client Name (Uploaded File)', 'Client Name (Email Sheet)', 'Confirmed Email'];
    for (let i = 1; i <= maxP; i++) headers.push('Potential Email ' + i);
    const rows = results.map(r => {
      const cols = [csvCell(r.clientName), csvCell(r.sheetNames.join('; ')), csvCell(r.confirmedEmail)];
      for (let i = 0; i < maxP; i++) cols.push(csvCell(r.potentialEmails[i] || ''));
      return cols.join(',');
    });
    const blob = new Blob([[headers.map(csvCell).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'email_match_results.csv'; a.click();
  }

  function csvCell(v) {
    const s = String(v || '');
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }

  fetch('/components/footer.html')
    .then(res => res.text())
    .then(data => {
      document.getElementById('footer').innerHTML = data;
    });
  
