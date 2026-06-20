// ─────────────────────────────────────────────────────────────────
// PAYOUT GENERATOR MODE — payout.js
// Depends on: shared.js, app.js
// ─────────────────────────────────────────────────────────────────

function runPayout(yr, mo, cycle) {
  const payoutDay  = cycle === '15' ? 15 : new Date(yr, mo, 0).getDate();
  const payoutDate = new Date(yr, mo - 1, payoutDay);
  const hcCutoff   = new Date(2025, 5, 30);

  // Build email records (optional — blank fields if no email sheet uploaded)
  const emailRecords = emailData.length ? buildEmailRecords() : [];
  const lookupEmail = name => {
    if (!emailRecords.length) return null;
    const parenMatch = String(name || '').match(/\(([^)]+)\)/);
    const normParen  = parenMatch ? normalizeName(parenMatch[1], true) : '';
    const normOuter  = normalizeName(String(name || '').replace(/\([^)]*\)/g, ' ').trim(), true);
    const find = n => emailRecords.find(r => r.normName === n || r.normParen === n);
    return (normParen && find(normParen)) || find(normOuter) || null;
  };

  // Build HC pending map from reference
  const hcPendingMap = {};
  if (refData.length > 1) {
    const rh = refData[0].map(h => h ? String(h).toLowerCase().trim() : '');
    const ibanIdx = rh.findIndex(h => h.includes('iban'));
    const noteIdx = rh.findIndex(h => h.includes('note'));
    if (ibanIdx !== -1 && noteIdx !== -1) {
      refData.slice(1).forEach(r => {
        if (!r || !r[ibanIdx]) return;
        const iban = String(r[ibanIdx]).replace(/\s/g, '');
        const note = r[noteIdx] ? String(r[noteIdx]).toLowerCase() : '';
        if (iban && note.includes('hc')) hcPendingMap[iban] = true;
      });
    }
  }

  // Helper: name variants for reroute matching
  const nameVariants = raw => {
    const s = String(raw || '');
    const m = s.match(/\(([^)]*)\)/);
    const out = [];
    if (m) { out.push(normalizeName(m[1], false)); out.push(normalizeName(s.replace(/\([^)]*\)/g, ''), false)); }
    out.push(normalizeName(s, false));
    return out.filter(Boolean);
  };

  const namesOverlap = (a, b) => { const A = nameVariants(a), B = nameVariants(b); return A.some(x => B.includes(x)); };

  // Lookup reroute entry for this row
  const rerouteFor = r => {
    if (!r || (!r.container && !r.clientName)) return null;
    if (r.pinFilledDown && !r.isSharedContainer) return null;
    const cont = r.container || '', nkey = normalizeName(r.clientName || '', false);
    const exact = rerouteMap.byKey[cont + '||' + nkey];
    if (exact) return { e: exact, contOk: true, nameOk: true };
    if (cont && rerouteMap.byCont[cont]) {
      const list = rerouteMap.byCont[cont];
      const pick = list.find(e => namesOverlap(r.clientName, e.clientName)) || list[0];
      return { e: pick, contOk: true, nameOk: namesOverlap(r.clientName, pick.clientName) };
    }
    for (const v of nameVariants(r.clientName)) {
      if (rerouteMap.byName[v]) return { e: rerouteMap.byName[v][0], contOk: false, nameOk: true };
    }
    return null;
  };

  // Filter by cycle + reroute validity
  const filtered = paymentData.filter(r => {
    if (r.pinFilledDown && !r.isSharedContainer) return false;
    const rr = rerouteFor(r);
    if (rr && rr.e.isFlexible) return false;       // flexible: skip
    if (rr && !rr.e.restartDate) return false;     // rerouted but no readable restart: skip
    const restart = rr ? rr.e.restartDate : null;
    // Cycle from restart day (01–15 → 15, else end-of-month); non-rerouted keep sheet cycle
    let c;
    if (restart) c = restart.getDate() <= 15 ? '15' : '30';
    else c = String(r.payoutCycle).replace(/\s/g, '');
    const cycleMatch = cycle === '15' ? c === '15' : (c === '30/31' || c === '30' || c === '31');
    const effStart = restart || r.firstPayout;
    const started  = !effStart || effStart <= payoutDate;
    return cycleMatch && started;
  });

  // Pre-pass — which clients have at least one contract end date
  const clientHasContractEnd = {};
  filtered.forEach(r => {
    if (!clientHasContractEnd[r.clientName]) clientHasContractEnd[r.clientName] = false;
    if (r.contractEnd) clientHasContractEnd[r.clientName] = true;
  });

  const { sharedGroups, mismatchFlags } = analyzeGroups(filtered);
  const mismatchContainers = new Set(mismatchFlags.map(f => f.container));

  const WEIGHTED_SPLITS = {
    'CONMO0379':   { 'Mohamed Rafi Hakeem': 0.75, 'Sundarrajan Dharmarajan Dhayalakumaran': 0.25 },
    'CONRA181':    { 'Rashedur Rahman Chowdhury': 0.50, 'Reshad Abd Alim': 0.25, 'Adnan Amin Ziaul Amin': 0.25 },
    'CONMRTMN0529':{ 'Muhammad Rameez Tahir Muhammad Naeem': 0.3333, 'Muhammad Jawad Tahir': 0.3333, 'Muhammad Junaid Jamshaid Hafiz Jamshaid Akhtar': 0.3333 },
    'CONNU0415':   { 'Nuzhat Mursaleen Faisal Fakir Mohammed': 0.61, 'Barayil Porakandy Roshan Valiyakath Aboobacker': 0.39 },
  };

  const groups = {};
  filtered.forEach(r => {
    const ibanValid = r.iban && /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(r.iban.replace(/\s/g, ''));
    const key       = (ibanValid ? r.iban.replace(/\s/g, '') : r.accountNo) || r.clientName;
    if (!groups[key]) {
      groups[key] = {
        index: r.index, clientName: r.clientName, iban: r.iban,
        accountNo: r.accountNo, swift: r.swift, bankName: r.bankName,
        clientType: r.clientType, containers: [], totalReturn: 0,
        totalDeduction: 0, deductionItems: [], structuralNotes: [],
        balanceNotes: new Set(), agents: new Set(),
        firstPayout: r.firstPayout,
        rerouteDates: [],
      };
    }

    const g = groups[key];
    const rr = rerouteFor(r);
    const dedBasis = deductionBasis(r.firstPayout, (rr && rr.e.restartDate) ? rr.e.restartDate : null);
    g.containers.push(r.container);
    if (r.agent) g.agents.add(r.agent);
    g.totalReturn += (rr && rr.e.newRental) ? rr.e.newRental : r.returnAmt;
    if (rr && rr.e.restartDate) g.rerouteDates.push(fmtDate(rr.e.restartDate));
    if (rr && rr.contOk && !rr.nameOk) g.structuralNotes.push('⚑ Verify name — restart matched by container only');
    if (rr && !rr.contOk && rr.nameOk) g.structuralNotes.push('⚑ Verify container — restart matched by name only');

    if (r.contractClosedFlag) g.structuralNotes.push(r.contractClosedFlag);
    if (r.groupId === '__MANUAL_CHECK__') g.structuralNotes.push('⚑ No container or contract number — manual check required');
    if (r.noIban) g.structuralNotes.push('⚑ No IBAN and no account number — verify');
    if (r.clientTypeBlank) g.structuralNotes.push('⚑ Blank client type');
    if (r.returnInUSD) g.structuralNotes.push('⚑ Rental amount is in USD — verify AED conversion');

    const isCommission = r.container && r.container.toLowerCase() === 'commission';
    if (!isCommission) {
      if (!clientHasContractEnd[r.clientName]) {
        g.structuralNotes.push('⚑ No contract end date');
      } else if (r.contractEnd && r.contractEnd < new Date()) {
        g.structuralNotes.push('⚑ Contract end date has passed — verify');
      }
    }

    if (r.clientName === 'Abbas Zaigham' || r.clientName === 'Zaigham Abbas') {
      g.structuralNotes.push('⚑ For contract review — verify if same person as Abbas Zaigham / Zaigham Abbas');
    }

    if (r.balanceNote) {
      const fp = r.firstPayout;
      const isThisCycle = fp && fp.getFullYear() === yr && fp.getMonth() + 1 === mo
        && (cycle === '15' ? fp.getDate() === 15 : fp.getDate() === payoutDay);
      if (isThisCycle) g.balanceNotes.add(r.balanceNote);
    }

    const isHcEligible = r.payReceived && r.payReceived <= hcCutoff;
    const cleanIban    = r.iban ? r.iban.replace(/\s/g, '') : '';
    const hcPending    = hcPendingMap[cleanIban] || false;

    if (r.container && mismatchContainers.has(r.container)) {
      const mf = mismatchFlags.find(f => f.container === r.container);
      g.structuralNotes.push(`⚑ Duplicate container mismatch — container ${r.container} appears under different contracts (${mf.contractNos.join(' / ')}) — manual check`);
      const ded = calcDeduction(payoutDate, dedBasis, r.insuranceYearsCovered, isHcEligible, hcPending, yr, mo, r.containerType, !!rr);
      g.totalDeduction += ded.amount;
      g.deductionItems.push(...ded.items);
    } else if (r.groupId !== '__MANUAL_CHECK__' && sharedGroups[r.groupId]) {
      const sg = sharedGroups[r.groupId];
      if (!sg.deductionCalculated) {
        const ded = calcDeduction(payoutDate, dedBasis, r.insuranceYearsCovered, isHcEligible, hcPending, yr, mo, r.containerType, !!rr);
        sg.deductionAmount = ded.amount; sg.deductionItems = ded.items; sg.deductionCalculated = true;
      }
      const contractKey = r.contractNo || [...sg.contractNos].find(c => c !== '__NONE__') || '';
      const weightMap   = WEIGHTED_SPLITS[contractKey];
      const clientShare = weightMap ? (weightMap[r.clientName] ?? (1 / sg.clients.size)) : (1 / sg.clients.size);
      const splitLabel  = weightMap ? Object.values(weightMap).map(v => Math.round(v * 100)).join('-') : `${sg.clients.size} ways`;
      const splitItems  = sg.deductionItems.map(it => ({ ...it, amount: it.amount * clientShare }));
      g.totalDeduction += sg.deductionAmount * clientShare;
      g.deductionItems.push(...splitItems);
      if (sg.deductionAmount > 0) g.structuralNotes.push(`⚑ Shared group ${r.groupId} — deduction split ${splitLabel}`);
    } else {
      const ded = calcDeduction(payoutDate, dedBasis, r.insuranceYearsCovered, isHcEligible, hcPending, yr, mo, r.containerType, !!rr);
      g.totalDeduction += ded.amount;
      g.deductionItems.push(...ded.items);
    }
  });

  results = Object.values(groups).map(g => {
    const roundedDeduction = Math.round(g.totalDeduction);
    const y1Items   = g.deductionItems.filter(it => it.type === 'Y1 Insurance');
    const ipItems   = g.deductionItems.filter(it => it.type === 'Y2 Insurance' || it.type === 'Y3 Insurance');
    const hcApplied = g.deductionItems.filter(it => it.type === 'HC');
    const hcPending = g.deductionItems.filter(it => it.type === 'HC Pending');
    const y1WithOthers = y1Items.length > 0 && ipItems.length > 0;
    const visibleItems = [...y1Items, ...ipItems, ...hcApplied];
    const activeDates  = [...new Set(visibleItems.map(it => fmtDate(it.firstPayout)))];
    const rerouteDateStr = (g.rerouteDates && g.rerouteDates.length)
      ? [...new Set(g.rerouteDates)].join(' & ') : '';
    const firstPayoutDisplay = rerouteDateStr || activeDates.join(' & ') || fmtDate(g.firstPayout) || '';
    const deductionNotes = [];

    if (ipItems.length > 0) {
      const hasY1 = y1WithOthers, hasY2 = ipItems.some(it => it.type === 'Y2 Insurance'), hasY3 = ipItems.some(it => it.type === 'Y3 Insurance');
      const typeStr  = [hasY1 ? 'Y1' : null, hasY2 ? 'Y2' : null, hasY3 ? 'Y3' : null].filter(Boolean).join(' & ');
      const allItems = [...(y1WithOthers ? y1Items : []), ...ipItems];
      const totalAmt = Math.round(allItems.reduce((s, it) => s + it.amount, 0));
      const dates    = [...new Set(allItems.map(it => fmtDate(it.firstPayout)))];
      let ipNote = `${typeStr} IP ${totalAmt.toLocaleString()} from ${dates.join(' & ')}`;
      if (hcPending.length > 0) ipNote += ' — HC pending next cycle';
      deductionNotes.push(ipNote);
    } else if (hcPending.length > 0) {
      deductionNotes.push('HC pending next cycle');
    }
    if (hcApplied.length > 0) deductionNotes.push('HC 1,000 applied — double-check the contract');

    const agentArr = [...g.agents];
    if (agentArr.length > 1) g.structuralNotes.push(`⚑ Multiple agents: ${agentArr.join(' / ')}`);
    const agent = agentArr.length >= 1 ? agentArr[agentArr.length - 1] : '';

    const balanceNoteArr = [...g.balanceNotes];
    const allNotes = [...new Set(g.structuralNotes), ...deductionNotes, ...balanceNoteArr].join(' | ');
    const balanceNumeric = balanceNoteArr.length > 0
      ? (() => { const m = balanceNoteArr.join(' ').match(/[\d]+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; })() : null;
    const hasBalance = balanceNumeric !== null;

    // Email match
    const em = lookupEmail(g.clientName);
    const [emEmail1, emEmail2] = em ? splitEmails(em.clientEmailRaw) : ['', ''];

    return {
      ...g, agent, totalDeduction: roundedDeduction,
      rentalDue: hasBalance ? null : (g.totalReturn - roundedDeduction),
      balanceAddition: balanceNumeric, firstPayoutDisplay, note: allNotes,
      emailSheetClientName: em ? em.emailSheetClientName : '',
      email1: emEmail1, email2: emEmail2,
      mobile: em ? em.mobile : '',
      nationality: em ? em.nationality : '',
      eid: em ? em.eid : '',
    };
  });

  results.sort((a, b) => a.index - b.index);

  const cycleLabel = cycle === '15' ? '15th' : 'End of Month';
  showResultsSection(`${MONTHS[mo-1]} ${yr} — ${cycleLabel} · ${results.length} payees`);

  const totalReturn = results.reduce((s,r) => s + r.totalReturn, 0);
  const totalDeduct = results.reduce((s,r) => s + r.totalDeduction, 0);
  const totalDue    = results.reduce((s,r) => s + (r.rentalDue || 0), 0);
  const totalUnits = results.reduce((s,r) => s + r.containers.length, 0);
  renderStats([
    { val: results.length,            lbl: 'Payees' },
    { val: totalUnits,                lbl: 'Total Units' },
    { val: `AED ${fmt(totalReturn)}`, lbl: 'Total Rental' },
    { val: `AED ${fmt(totalDeduct)}`, lbl: 'Total Deductions' },
    { val: `AED ${fmt(totalDue)}`,    lbl: 'Total Due' },
    { val: results.filter(r => r.note).length, lbl: 'With Notes' },
  ]);

  const flagLines = [];
  const sharedCount = Object.keys(sharedGroups).length;
  if (sharedCount > 0) {
    const names = Object.entries(sharedGroups).map(([gid, meta]) => `${gid} (${[...meta.clients].join(' / ')})`).join('; ');
    flagLines.push(`⚑ ${sharedCount} shared group(s) — deduction split: ${names}`);
  }
  mismatchFlags.forEach(f => {
    flagLines.push(`🔴 Duplicate container mismatch: ${f.container} — contracts ${f.contractNos.join(' / ')} — clients: ${f.clientNames.join(' / ')} — manual check required`);
  });
  renderFlags(flagLines);

  document.getElementById('tableHead').innerHTML = `<tr>
    <th>#</th><th>Name of Clients</th>
    <th style="text-align:right">Monthly Rental</th>
    <th style="text-align:right">Deduction</th>
    <th style="text-align:right">Addition</th>
    <th style="text-align:right">Rental Due</th>
    <th>Notes</th>
  </tr>`;

  document.getElementById('tableBody').innerHTML = results.slice(0, PREVIEW_COUNT).map((r, i) => `
    <tr>
      <td class="td-hint">${i+1}</td>
      <td class="td-name">${esc(r.clientName)}</td>
      <td class="td-num">${fmt(r.totalReturn)}</td>
      <td class="td-deduct">${r.totalDeduction > 0 ? fmt(r.totalDeduction) : '—'}</td>
      <td class="td-num">${r.balanceAddition !== null ? fmt(r.balanceAddition) : '—'}</td>
      <td class="td-due">${r.rentalDue !== null ? fmt(r.rentalDue) : '—'}</td>
      <td class="td-note">${renderNote(r.note)}</td>
    </tr>`).join('');

  renderMoreRows(results.length);
}

function exportPayout() {
  const yr    = parseInt(document.getElementById('selYear').value);
  const mo    = parseInt(document.getElementById('selMonth').value);
  const cycle = document.getElementById('selCycle').value;

  const headers = ['CLIENT TYPE','CLIENT NAME',
    'CLIENT NAME (EMAIL SHEET)','EMAIL 1','EMAIL 2','MOBILE','NATIONALITY','EID/PASSPORT/NATIONAL CARD',
    'UNIT','FIRST PAYOUT',
    'MONTHLY RENT','DEDUCTION','ADDITION','RENTAL DUE',
    'ACCOUNT NO.','IBAN NO.','SWIFT CODE','BANK NAME','AGENT NAME','NOTES'];

  const rows = results.map(r => [
    r.clientType || '', r.clientName,
    r.emailSheetClientName || '', r.email1 || '', r.email2 || '', r.mobile || '', r.nationality || '', r.eid || '',
    r.containers.length,
    r.firstPayoutDisplay || '', r.totalReturn,
    r.totalDeduction || null, r.balanceAddition || null,
    r.rentalDue !== null ? r.rentalDue : null,
    r.accountNo, r.iban, r.swift, r.bankName, r.agent || '', r.note || '',
  ]);

  const totReturn = results.reduce((s,r) => s + r.totalReturn, 0);
  const totDeduct = results.reduce((s,r) => s + r.totalDeduction, 0);
  const totDue    = results.reduce((s,r) => s + (r.rentalDue || 0), 0);
  rows.push(['','TOTAL','','','','','','','','',totReturn,totDeduct,'',totDue,'','','','','','']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{wch:14},{wch:45},{wch:45},{wch:30},{wch:30},{wch:16},{wch:16},{wch:24},{wch:8},{wch:14},{wch:14},{wch:12},{wch:12},{wch:14},{wch:22},{wch:30},{wch:18},{wch:28},{wch:20},{wch:50}];
  XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[mo-1]} ${yr} - ${cycle === '15' ? '15th' : 'EOM'}`.substring(0, 31));
  XLSX.writeFile(wb, getExpectedOutputFilename());
}
