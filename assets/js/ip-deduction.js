// ─────────────────────────────────────────────────────────────────
// IP DEDUCTION MODE — ip-deduction.js
// Depends on: shared.js, app.js
// Uses the same shared deduction engine as payout.js (calcPayeeDeductions
// in shared.js) — WEIGHTED_SPLITS, HC pending, contract-closed/no-IBAN
// flags, and the cycle fix all stay in sync with Payout Generator.
// This file only adds: filtering out zero-deduction rows and its own
// 12-column export.
// ─────────────────────────────────────────────────────────────────

function runIPDeduction(yr, mo, cycle) {
  const payoutDay  = cycle === '15' ? 15 : new Date(yr, mo, 0).getDate();
  const payoutDate = new Date(yr, mo - 1, payoutDay);

  // Filter by cycle + reroute validity (shared logic — original cycle always wins)
  const filtered = filterRowsForCycle(paymentData, cycle, payoutDate);

  // Shared deduction engine
  const { groups } = calcPayeeDeductions(filtered, yr, mo, payoutDate);

  results = Object.values(groups)
    .filter(g => g.totalDeduction > 0)
    .map(g => ({ ...g }));

  sortResultsByAccountsOrder(results, accountsListRows);

  const cycleLabel = cycle === '15' ? '15th' : 'End of Month';
  showResultsSection(`${MONTHS[mo-1]} ${yr} — ${cycleLabel} · ${results.length} clients with deductions`);

  const totalDeduct = results.reduce((s,r) => s + r.totalDeduction, 0);
  renderStats([
    { val: results.length,            lbl: 'Clients' },
    { val: `AED ${fmt(totalDeduct)}`, lbl: 'Total Deductions' },
    { val: results.filter(r => r.deductionItems.some(i => i.type.includes('Y1'))).length, lbl: 'Y1 IP' },
    { val: results.filter(r => r.deductionItems.some(i => i.type.includes('Y2'))).length, lbl: 'Y2 IP' },
    { val: results.filter(r => r.deductionItems.some(i => i.type.includes('Y3'))).length, lbl: 'Y3 IP' },
    { val: results.filter(r => r.deductionItems.some(i => i.type === 'HC')).length,       lbl: 'HC' },
  ]);

  renderFlags([]);

  document.getElementById('tableHead').innerHTML = `<tr>
    <th>#</th><th>Name of Clients</th>
    <th style="text-align:center">Units</th>
    <th style="text-align:center">First Payout Date</th>
    <th style="text-align:right">Deduction</th>
    <th>Deduction Breakdown</th>
  </tr>`;

  document.getElementById('tableBody').innerHTML = results.slice(0, PREVIEW_COUNT).map((r, i) => {
    const fp = r.deductionItems[0] ? fmtDate(r.deductionItems[0].firstPayout) : '—';
    return `<tr>
      <td class="td-hint">${i+1}</td>
      <td class="td-name">${esc(r.clientName)}</td>
      <td class="td-center td-mono">${new Set(r.deductionItems.map(it => it.container)).size}</td>
      <td class="td-mono">${fp}</td>
      <td class="td-deduct">${fmt(r.totalDeduction)}</td>
      <td class="td-note">${renderNote(r.note)}</td>
    </tr>`;
  }).join('');

  renderMoreRows(results.length);
}

function exportIPDeduction() {
  const yr  = parseInt(document.getElementById('selYear').value);
  const mo  = parseInt(document.getElementById('selMonth').value);

  const headers = ['CLIENT NAME', 'UNITS','DEDUCTION (AED)','NOTES'];
  const rows = results.map(r => [
    r.clientName,
    new Set(r.deductionItems.map(it => it.container)).size,
    r.totalDeduction, r.note || '',
  ]);

  const totDeduct = results.reduce((s,r) => s + r.totalDeduction, 0);
  rows.push(['TOTAL','',totDeduct,'']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{wch:45},{wch:12},{wch:16},{wch:60}];
  XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[mo-1]} ${yr} IP Deduction`.substring(0, 31));
  XLSX.writeFile(wb, getExpectedOutputFilename());
}
