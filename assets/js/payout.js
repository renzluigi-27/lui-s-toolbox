// ─────────────────────────────────────────────────────────────────
// PAYOUT GENERATOR MODE — payout.js
// Depends on: shared.js, app.js
// Deduction logic (cycle filter, reroute, WEIGHTED_SPLITS, HC pending,
// contract-closed/no-IBAN flags) lives in shared.js.
// This file adds rental/rentalDue, totalCost, balance-pending notes,
// and payout-specific extra notes/flags. Quarterly/yearly clients keep
// their monthly rental figure — no ×3/×12 multiplier — a note in
// shared.js flags the frequency for manual verification with accounts.
//
// DEDUCTION SPLIT / CARRYOVER — if a container's IP/HC deduction this
// cycle is more than that client's rent can cover, the deduction is
// capped at rent (Rental Due never goes negative) and the remainder is
// written to the DEDUCTION REMAINING export column, per container, as
// "container:amount:n/total". Uploading that export as next cycle's
// reference file (via parseDeductionCarryover in app.js) picks the
// remainder back up and continues collecting it until fully paid.
// ─────────────────────────────────────────────────────────────────

function computeDeductionSplit(g, rent, carryover) {
  rent = Math.max(0, rent || 0);

  const containersOrder = [...new Set(g.containers)];
  const due = {};

  containersOrder.forEach(c => {
    const newAmt   = (g.dedByContainer && g.dedByContainer[c]) ? g.dedByContainer[c] : { ip: 0, hc: 0 };
    const yearMap  = (g.dedByContainerYear && g.dedByContainerYear[c]) ? g.dedByContainerYear[c] : null;
    const carried  = carryover[c];
    const newTotal = Math.round((newAmt.ip || 0) + (newAmt.hc || 0));
    if (newTotal <= 0 && !carried) return; // nothing due for this container this cycle

    due[c] = {
      ip: newAmt.ip || 0, hc: newAmt.hc || 0,
      yearMap,
      newTotal,
      carriedRemaining: carried ? carried.remaining : 0,
      isContinuing: !!carried,
      nextInstallment: carried ? carried.nextInstallment : null,
      totalInstallments: carried ? carried.totalInstallments : null,
      carriedLabelCode: carried ? carried.labelCode : null,
    };
  });

  let available = rent;
  let appliedDeduction = 0;
  const noteLines = [];
  const remainingExport = [];
  const cleanContainers = {}; // "label|amount" -> { label, amount, containers[] } — same label AND same per-container amount grouped as one line

  Object.keys(due).forEach(c => {
    const d = due[c];
    const totalOwed = Math.round(d.newTotal + d.carriedRemaining);
    const hasFresh = d.ip > 0 || d.hc > 0;
    // A continuing installment keeps whatever type/year it started as; a
    // brand new deduction this cycle (even alongside a carryover) uses
    // the fresh type — reusing the same Y2/Y3-aware labels shared.js
    // already builds for the IP Deduction tool.
    const labelCode = hasFresh ? buildYearLabelCode(d.yearMap) : (d.carriedLabelCode || 'BOTH');
    const label = hasFresh ? buildYearLabel(d.yearMap) : yearLabelCodeToDisplay(d.carriedLabelCode);
    const pay = Math.min(available, totalOwed);
    available -= pay;
    appliedDeduction += pay;
    const remaining = Math.round(totalOwed - pay);
    const payRounded = Math.round(pay);

    if (!d.isContinuing && remaining <= 0) {
      const groupKey = `${label}|${payRounded}`;
      if (!cleanContainers[groupKey]) cleanContainers[groupKey] = { label, amount: payRounded, containers: [] };
      cleanContainers[groupKey].containers.push(c);
      return;
    }

    let thisInstallmentNum, totalInstallments;
    if (d.isContinuing) {
      thisInstallmentNum = d.nextInstallment;
      totalInstallments  = d.totalInstallments;
    } else {
      totalInstallments  = Math.max(2, Math.ceil(totalOwed / (rent || 1)));
      thisInstallmentNum = 1;
    }
    const installmentLabel = `${thisInstallmentNum}/${totalInstallments}`;

    if (remaining <= 0) {
      noteLines.push(Notes.splitDeductedFullyCollected(payRounded, label, c, installmentLabel));
    } else {
      noteLines.push(Notes.splitDeductedRemaining(payRounded, label, c, installmentLabel, remaining));
      remainingExport.push(`${c}:${remaining}:${thisInstallmentNum + 1}/${totalInstallments}:${labelCode}`);
    }
  });

  const consolidatedParts = Object.values(cleanContainers).map(grp =>
    Notes.consolidatedDeduction(grp.amount, grp.label, grp.containers)
  );

  return {
    appliedDeduction: Math.round(appliedDeduction),
    rentalDue: Math.round(rent - appliedDeduction),
    noteLines,
    consolidatedLine: consolidatedParts.length ? consolidatedParts.join(' | ') : null,
    remainingExport,
  };
}

function runPayout(yr, mo, cycle) {
  const payoutDay  = cycle === '15' ? 15 : new Date(yr, mo, 0).getDate();
  const payoutDate = new Date(yr, mo - 1, payoutDay);

  const carryoverMap = (refData && refData.length) ? parseDeductionCarryover(refData) : {};

  const filtered = filterRowsForCycle(paymentData, cycle, payoutDate);

  const { groups, sharedGroups, mismatchFlags } = calcPayeeDeductions(filtered, yr, mo, payoutDate);

  const rentalByKey    = {};
  const totalCostByKey = {};
  const balanceNotesByKey = {};

  filtered.forEach(r => {
    const ibanValid = r.iban && /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(r.iban.replace(/\s/g, ''));
    const key = (ibanValid ? r.iban.replace(/\s/g, '') : r.accountNo) || r.clientName;
    if (!groups[key] || r.isTerminated) return;

    const baseRental = (r.isRerouted && r.revisedRental) ? r.revisedRental : r.returnAmt;

    if (!rentalByKey[key]) rentalByKey[key] = 0;
    rentalByKey[key] += baseRental;

    if (!totalCostByKey[key]) totalCostByKey[key] = 0;
    totalCostByKey[key] += r.totalCost || 0;

    if (r.returnInUSD) groups[key].deductionNotes.push(Notes.rentalInUSD());

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

    const split = computeDeductionSplit(g, totalReturn, carryoverMap[key] || {});

    const flagNotes = [...new Set(g.deductionNotes)];
    const allNotes = [split.consolidatedLine, ...split.noteLines, ...flagNotes, ...balanceNoteArr]
      .filter(Boolean).join(' | ');

    return {
      ...g, totalCost,
      totalReturn: g.allTerminated ? null : totalReturn,
      totalDeduction: g.allTerminated ? null : split.appliedDeduction,
      rentalDue: g.allTerminated ? null : (hasBalance ? null : split.rentalDue),
      deductionRemainingExport: split.remainingExport.join(' | '),
      balanceAddition: g.allTerminated ? null : balanceNumeric, note: allNotes,
    };
  });

  sortResultsByAccountsOrder(results, accountsListRows);

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
    flagLines.push(Notes.sharedGroupsSummary(sharedCount, names));
  }
  mismatchFlags.forEach(f => {
    flagLines.push(Notes.duplicateContainerMismatch(f.container, f.contractNos, f.clientNames));
  });
  const carriedCount = results.filter(r => r.deductionRemainingExport).length;
  if (carriedCount > 0) {
    flagLines.push(Notes.carriedToNextCycleSummary(carriedCount));
  }
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
    'UNIT', 'FIRST PAYOUT',
    'MONTHLY RENT', 'DEDUCTION', 'ADDITION', 'RENTAL DUE',
    'ACCOUNT NO.', 'IBAN NO.', 'SWIFT CODE', 'BANK NAME', 'AGENT NAME', 'DEDUCTION REMAINING', 'NOTES',
  ];

  const rows = results.map(r => [
    r.clientType || '', r.clientName,
    r.containers.length,
    r.firstPayoutDisplay || '',
    r.totalReturn,
    r.totalDeduction || null, r.balanceAddition || null,
    r.rentalDue !== null ? r.rentalDue : null,
    r.accountNo, r.iban, r.swift, r.bankName, r.agent || '',
    r.deductionRemainingExport || '',
    r.note || '',
  ]);

  const totReturn   = results.reduce((s,r) => s + r.totalReturn, 0);
  const totDeduct   = results.reduce((s,r) => s + r.totalDeduction, 0);
  const totDue      = results.reduce((s,r) => s + (r.rentalDue || 0), 0);
  rows.push(['','TOTAL','','','','','','','','', totReturn, totDeduct,'', totDue,'','','','','','','']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    {wch:14},{wch:45},{wch:45},{wch:30},{wch:30},{wch:16},{wch:16},{wch:24},
    {wch:8},{wch:14},
    {wch:14},{wch:12},{wch:12},{wch:14},
    {wch:22},{wch:30},{wch:18},{wch:28},{wch:20},{wch:30},{wch:50},
  ];
  XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[mo-1]} ${yr} - ${cycle === '15' ? '15th' : 'EOM'}`.substring(0, 31));
  XLSX.writeFile(wb, getExpectedOutputFilename());
}
