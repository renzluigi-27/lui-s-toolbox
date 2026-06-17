// ─────────────────────────────────────────────────────────────────
// EMAIL MATCHER MODE — email-matcher.js
// Depends on: shared.js, app.js
// ─────────────────────────────────────────────────────────────────

function parseDateValue(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return '';
    return `${String(parsed.d).padStart(2,'0')}/${String(parsed.m).padStart(2,'0')}/${parsed.y}`;
  }
  const raw = String(value).trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/);
  if (match) {
    let a = parseInt(match[1],10), b = parseInt(match[2],10), c = parseInt(match[3],10);
    let day, month, year;
    if (match[1].length === 4) { year=a; month=b; day=c; } else { day=a; month=b; year=c; }
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;
  }
  return '';
}

function splitEmails(value) {
  const text = String(value || '').trim();
  if (!text) return ['',''];
  const parts = text.split(/[,:;\s]+/).map(p => p.trim()).filter(Boolean);
  return [parts[0] || '', parts[1] || ''];
}

function buildEmailRecords() {
  const rows = emailData.slice(1);

  // Fill-down email (col 15) only within same client — don't fill-down mobile
  let lastEmail = '';
  let lastClientName = '';

  rows.forEach(row => {
    const e = row[15] != null ? String(row[15]).trim() : '';
    const clientName = String(row[0] || '').trim();
    
    // Reset email when switching to different client
    if (clientName !== lastClientName) {
      lastEmail = '';
      lastClientName = clientName;
    }
    
    // Fill-down email only for same client
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
      agentEmail: String(row[2] || '').split(/[,:;\s]+/)[0].trim(),
      paymentReceivedDate: parseDateValue(row[5]),
      clientEmailRaw: emailRaw,
      mobile: String(row[16] || '').split(/[,;]+/)[0].replace(/\s+/g,'').trim(),
      nationality: row[17] != null ? String(row[17]).trim() : '',
      eid: row[18] != null ? String(row[18]).trim() : '',
      multipleEmails: emails.length > 1,
    };

    if (!grouped.has(normName)) grouped.set(normName, record);
    if (normParen && !grouped.has(normParen)) grouped.set(normParen, record);
  });

  return Array.from(grouped.values());
}

const AGENT_EMAIL_MAP = {
  'faiqa':             'bdm@legendmaritime.com',
  'naushad':           'manager@coraluae.com',
  'numan':             'wm@aim-bc.com',
  'kate':              'wm@aim-bc.com',
  'ali altawel':       'ali_altawel@legendmaritime.com',
  'mustafa':           'ali_altawel@legendmaritime.com',
  'janagan':           'janagan@legendmaritime.com',
  'christian':         'christian@legendmaritime.com',
  'himali':            'renz@legendmaritime.com',
  'ms. sagithra nath': 'cfo@legendmaritime.com',
  'sagithra nath':     'cfo@legendmaritime.com',
  'mag':               'lauriane@legendmaritime.com',
  'mr. ahnaf':         'mohamedahnaf@legendmaritime.com',
  'ahnaf':             'mohamedahnaf@legendmaritime.com',
  'ruheed':            'ruheed@coraluae.com',
  'athul':             'athul@coraluae.com',
  'sanjana':           'sanjana@legendmaritime.com',
  'khadija':           'khadija@coraluae.com',
  'renz':              'renz@legendmaritime.com',
};

function runEmailMatcher(yr, mo, cycle, cycleOpt, nameMode) {
  if (!emailData.length) { showMsg('genError', 'Please upload the email sheet.', 'error'); return; }

  const emailRecords = buildEmailRecords();

  const prevMatchMap = new Map();
  if (refData.length > 1) {
    refData.slice(1).forEach(r => {
      if (!r || !r[0]) return;
      const normName = normalizeName(String(r[0]), true);
      prevMatchMap.set(normName, {
        email1: String(r[3] || '').trim(),
        email2: String(r[4] || '').trim(),
        mobile: String(r[5] || '').trim(),
        emailSheetClientName: String(r[1] || '').trim(),
      });
    });
  }

  const payoutDay  = cycle === '15' ? 15 : new Date(yr, mo, 0).getDate();
  const payoutDate = new Date(yr, mo - 1, payoutDay);

  const paySource = (cycleOpt === 'all')
    ? paymentData.filter(r => !r.firstPayout || r.firstPayout <= payoutDate)
    : paymentData.filter(r => {
        const c = String(r.payoutCycle).replace(/\s/g, '');
        const cycleMatch = cycle === '15' ? c === '15' : (c === '30/31' || c === '30' || c === '31');
        return cycleMatch && (!r.firstPayout || r.firstPayout <= payoutDate);
      });

  const rowsToProcess = (nameMode === 'unique')
    ? (() => {
        const seen = new Map();
        paySource.forEach(r => {
          const key = normalizeName(r.clientName, false);
          if (!seen.has(key)) seen.set(key, r);
        });
        return Array.from(seen.values());
      })()
    : paySource;

  _emCycleOpt = cycleOpt;
  _emNameMode = nameMode;

  results = rowsToProcess.map(row => {
    const group = { clientName: row.clientName, norm: normalizeName(row.clientName, false),
                    units: 1, agent: row.agent || '', note: '' };
    const group_norm = group.norm;
    const normName   = group_norm;
    const parenMatch = group.clientName.match(/\(([^)]+)\)/);
    const normParen  = parenMatch ? normalizeName(parenMatch[1], true) : '';
    const normOuter  = normalizeName(group.clientName.replace(/\([^)]*\)/g, ' ').trim(), true);

    const lookup  = n => emailRecords.find(r => r.normName === n || r.normParen === n);
    const matched = (normParen && lookup(normParen)) || lookup(normOuter) || null;

    const [email1raw, email2raw] = splitEmails(matched ? matched.clientEmailRaw : '');
    let email1 = email1raw, email2 = email2raw, mobile = matched ? matched.mobile : '';

    let emailSheetClientNameFromRef = '';
    const prev = prevMatchMap.get(normName);
    if (prev) {
      if (!email1 && prev.email1) { email1 = prev.email1; email2 = prev.email2; }
      if (!mobile && prev.mobile) mobile = prev.mobile;
      if (!matched && prev.emailSheetClientName) emailSheetClientNameFromRef = prev.emailSheetClientName;
    }

    const resolvedAgentEmail = AGENT_EMAIL_MAP[group.agent.toLowerCase().trim()] || '';

    const notes = [];
    const hasMultiAgents = group.note && /multiple agents/i.test(group.note);
    if (hasMultiAgents) {
      notes.push(group.note);
    } else {
      if (!matched)                          notes.push('Name not found in email sheet');
      if (matched && !email1)                notes.push('Email missing in email sheet');
      if (matched && matched.multipleEmails) notes.push('Multiple emails detected');
      if (matched && !resolvedAgentEmail)    notes.push('Agent email missing');
      if (matched && !group.agent)           notes.push('Agent name missing');
    }

    if (/saif mohammed saif mohammed almehrzi/i.test(group.clientName)) {
      notes.push('⚑ Double check — verify client identity');
    }
    if (/coral wealth investment/i.test(group.clientName)) {
      notes.push('⚑ No email found — verify');
    }
    if (/maryam rashed moham alzeyoudi/i.test(group.clientName)) {
      notes.push('⚑ Not in email sheet — verify');
    }

    const status = matched ? 'valid' : 'invalid';

    return {
      clientName: group.clientName,
      emailSheetClientName: matched ? matched.emailSheetClientName : emailSheetClientNameFromRef,
      units: group.units, email1, email2, mobile,
      nationality: matched ? matched.nationality : '',
      eid: matched ? matched.eid : '',
      agentClosing: group.agent, agentEmail: resolvedAgentEmail,
      notes: notes.join(' | '), status,
    };
  });

  const cycleLabel = cycleOpt === 'all' ? 'All Clients' : (cycle === '15' ? '15th' : 'End of Month');
  const nameLabel  = nameMode === 'unique' ? 'Unique Names' : 'Repeating';
  showResultsSection(`${MONTHS[mo-1]} ${yr} — ${cycleLabel} · ${nameLabel} · ${results.length} rows`);

  const confirmed    = results.filter(r => r.status === 'valid').length;
  const clientErrors = results.filter(r => r.notes && (/name not found|email missing|multiple emails/i.test(r.notes))).length;
  const agentErrors  = results.filter(r => r.notes && (/agent email|agent name|multiple agents/i.test(r.notes))).length;

  renderStats([
    { val: results.length, lbl: 'Total' },
    { val: confirmed,      lbl: 'Confirmed' },
    { val: clientErrors,   lbl: 'Client Errors' },
    { val: agentErrors,    lbl: 'Agent Errors' },
  ]);

  renderFlags([]);

  document.getElementById('tableHead').innerHTML = `<tr>
    <th>#</th>
    <th>Client Name (Payment Sheet)</th>
    <th>Client Name (Email Sheet)</th>
    <th>Email 1</th>
    <th>Agent Closing</th>
    <th>Notes</th>
  </tr>`;

  document.getElementById('tableBody').innerHTML = results.slice(0, PREVIEW_COUNT).map((r, i) => {
    const noteBadge = r.notes
      ? `<span class="badge ${r.status === 'valid' ? 'badge-warn' : 'badge-flag'}">${esc(r.notes)}</span>`
      : `<span class="badge badge-ok">Confirmed</span>`;
    return `<tr>
      <td class="td-hint">${i+1}</td>
      <td class="td-name">${esc(r.clientName)}</td>
      <td style="color:var(--text-muted);font-size:12px">${esc(r.emailSheetClientName || '—')}</td>
      <td class="td-mono">${esc(r.email1 || '—')}</td>
      <td>${esc(r.agentClosing || '—')}</td>
      <td class="td-note">${noteBadge}</td>
    </tr>`;
  }).join('');

  renderMoreRows(results.length);
}

function exportEmailMatcher() {
  const yr = parseInt(document.getElementById('selYear').value);
  const mo = parseInt(document.getElementById('selMonth').value);

  const exportRows = results.map(r => ({
    'Client Name (LMC Sheet)':   r.clientName,
    'Client Name (Email Sheet)': r.emailSheetClientName,
    'Units':         r.units,
    'Email 1':       r.email1,
    'Email 2':       r.email2,
    'Mobile':        r.mobile,
    'Nationality':   r.nationality,
    'EID/Passport/National Card': r.eid,
    'Agent Closing': r.agentClosing,
    'Agent Email':   r.agentEmail,
    'Notes':         r.notes,
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[mo-1]} ${yr} Email Matcher`.substring(0, 31));
  const cycleTag = _emCycleOpt === 'all' ? 'ALL' : (document.getElementById('selCycle').value === '15' ? '15' : '30');
  const nameTag  = _emNameMode === 'unique' ? 'UNIQUE' : 'REPEAT';
  XLSX.writeFile(wb, `EMAIL_MATCHER_${cycleTag}_${nameTag}_${MONTHS[mo-1].toUpperCase()}${yr}.xlsx`);
}
