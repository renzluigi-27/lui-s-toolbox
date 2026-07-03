// ─────────────────────────────────────────────────────────────────
// PAYOUT GENERATOR MODE — payout.js
// Depends on: shared.js, app.js
// Deduction logic (cycle filter, reroute, WEIGHTED_SPLITS, HC pending,
// contract-closed/no-IBAN flags) lives in shared.js — calcPayeeDeductions().
// This file adds rental/rentalDue, totalCost, balance-pending notes,
// and payout-specific extra notes/flags on top.
// ─────────────────────────────────────────────────────────────────

function runPayout(yr, mo, cycle) {
  const payoutDay  = cycle === '15' ? 15 : new Date(yr, mo, 0).getDate();
  const payoutDate = new Date(yr, mo - 1, payoutDay);

  // Build email records (optional — blank fields if no email sheet uploaded)
  const emailRecords = emailData.length ? buildEmailRecords() : [];

  // Filter by cycle + reroute validity
  const filtered = filterRowsForCycle(paymentData, cycle, payoutDate);

  // Shared deduction engine
  const { groups, sharedGroups, mismatchFlags } = calcPayeeDeductions(filtered, yr, mo, payoutDate);

  // ── Payout-specific layer: rental totals, total cost, balance notes, extra flags ──
  const rentalByKey    = {};
  const totalCostByKey = {};
  const balanceNotesByKey = {};

  filtered.forEach(r => {
    const ibanValid = r.iban && /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(r.iban.replace(/\s/g, ''));
    const key = (ibanValid ? r.iban.replace(/\s/g, '') : r.accountNo) || r.clientName;
    if (!groups[key]) return; // safety

    // Rental: use revisedRental [LMC] for rerouted clients, returnAmt for others
    if (!rentalByKey[key]) rentalByKey[key] = 0;
    rentalByKey[key] += (r.isRerouted && r.revisedRental) ? r.revisedRental : r.returnAmt;

    // Total cost: sum col 15 across all containers per client
    if (!totalCostByKey[key]) totalCostByKey[key] = 0;
    totalCostByKey[key] += r.totalCost || 0;

    if (r.returnInUSD) groups[key].deductionNotes.push('⚑ Rental amount is in USD — verify AED conversion');

    

    if (r.balanceNote) {
      const fp = r.firstPayout;
      const isThisCycle = fp && fp.getFullYear() === yr && fp.getMonth() + 1 === mo
        && (cycle === '15' ? fp.getDate() === 15 : fp.getDate() === payoutDay);
      if (isThisCycle) {
        if (!balanceNotesByKey[key]) balanceNotesByKey[key] = new Set();
        balanceNotesByKey[key].add(r.balanceNote);
      }
    }
  });

  results = Object.values(groups).map(g => {
    const key = (g.iban && /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(g.iban.replace(/\s/g, '')))
      ? g.iban.replace(/\s/g, '') : (g.accountNo || g.clientName);
    const totalReturn    = rentalByKey[key]    || 0;
    const totalCost      = totalCostByKey[key] || 0;
    const balanceNoteArr = balanceNotesByKey[key] ? [...balanceNotesByKey[key]] : [];
    const balanceNumeric = balanceNoteArr.length > 0
      ? (() => { const m = balanceNoteArr.join(' ').match(/[\d]+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; })() : null;
    const hasBalance = balanceNumeric !== null;

    const allNotes = [g.note, ...balanceNoteArr].filter(Boolean).join(' | ');

    // Email match
    const em = lookupEmailRecord(emailRecords, g.clientName);
    const [emEmail1, emEmail2] = em ? splitEmails(em.clientEmailRaw) : ['', ''];

    return {
      ...g, totalReturn, totalCost,
      rentalDue: hasBalance ? null : (totalReturn - g.totalDeduction),
      balanceAddition: balanceNumeric, note: allNotes,
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
  const totalUnits  = results.reduce((s,r) => s + r.containers.length, 0);
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

  const headers = [
    'CLIENT TYPE', 'CLIENT NAME',
    'CLIENT NAME (EMAIL SHEET)', 'EMAIL 1', 'EMAIL 2', 'MOBILE', 'NATIONALITY', 'EID/PASSPORT/NATIONAL CARD',
    'UNIT', 'FIRST PAYOUT', 'TOTAL COST',
    'MONTHLY RENT', 'DEDUCTION', 'ADDITION', 'RENTAL DUE',
    'ACCOUNT NO.', 'IBAN NO.', 'SWIFT CODE', 'BANK NAME', 'AGENT NAME', 'NOTES',
  ];

  const rows = results.map(r => [
    r.clientType || '', r.clientName,
    r.emailSheetClientName || '', r.email1 || '', r.email2 || '', r.mobile || '', r.nationality || '', r.eid || '',
    r.containers.length,
    r.firstPayoutDisplay || '',
    r.totalCost || null,
    r.totalReturn,
    r.totalDeduction || null, r.balanceAddition || null,
    r.rentalDue !== null ? r.rentalDue : null,
    r.accountNo, r.iban, r.swift, r.bankName, r.agent || '', r.note || '',
  ]);

  const totReturn   = results.reduce((s,r) => s + r.totalReturn, 0);
  const totCost     = results.reduce((s,r) => s + (r.totalCost || 0), 0);
  const totDeduct   = results.reduce((s,r) => s + r.totalDeduction, 0);
  const totDue      = results.reduce((s,r) => s + (r.rentalDue || 0), 0);
  rows.push(['','TOTAL','','','','','','','','', totCost, totReturn, totDeduct,'', totDue,'','','','','','']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    {wch:14},{wch:45},{wch:45},{wch:30},{wch:30},{wch:16},{wch:16},{wch:24},
    {wch:8},{wch:14},{wch:14},
    {wch:14},{wch:12},{wch:12},{wch:14},
    {wch:22},{wch:30},{wch:18},{wch:28},{wch:20},{wch:50},
  ];
  XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[mo-1]} ${yr} - ${cycle === '15' ? '15th' : 'EOM'}`.substring(0, 31));
  XLSX.writeFile(wb, getExpectedOutputFilename());
}
