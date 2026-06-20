// ─────────────────────────────────────────────────────────────────
// IP DEDUCTION MODE — ip-deduction.js
// Depends on: shared.js, app.js
// ─────────────────────────────────────────────────────────────────

function runIPDeduction(yr, mo, cycle) {
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
    const c = String(r.payoutCycle).replace(/\s/g, '');
    const cycleMatch = cycle === '15' ? c === '15' : (c === '30/31' || c === '30' || c === '31');
    const started    = !r.firstPayout || r.firstPayout <= payoutDate;
    return cycleMatch && started;
  });

  const { sharedGroups, mismatchFlags } = analyzeGroups(filtered);
  const mismatchContainers = new Set(mismatchFlags.map(f => f.container));

  const groups = {};
  filtered.forEach(r => {
    const ibanValid = r.iban && /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(r.iban.replace(/\s/g, ''));
    const key       = (ibanValid ? r.iban.replace(/\s/g, '') : r.accountNo) || r.clientName;
    if (!groups[key]) {
      groups[key] = {
        index: r.index, clientName: r.clientName, iban: r.iban,
        accountNo: r.accountNo, containers: [], totalDeduction: 0,
        deductionItems: [], notes: [],
      };
    }
    const g = groups[key];
    g.containers.push(r.container);

    if (r.returnInUSD) g.notes.push('⚑ Rental amount is in USD — verify AED conversion');

    const rr = rerouteFor(r);
    const dedBasis = deductionBasis(r.firstPayout, (rr && rr.e.restartDate) ? rr.e.restartDate : null);
    const isHcEligible = r.payReceived && r.payReceived <= hcCutoff;

    let clientShare = 1;
    if (r.container && mismatchContainers.has(r.container)) {
      const mf = mismatchFlags.find(f => f.container === r.container);
      g.notes.push(`⚑ Duplicate container mismatch: ${r.container} — contracts ${mf.contractNos.join(' / ')}`);
      const ded = calcDeduction(payoutDate, dedBasis, r.insuranceYearsCovered, isHcEligible, false, yr, mo, r.containerType, !!rr);
      g.totalDeduction += ded.amount;
      g.deductionItems.push(...ded.items);
    } else if (r.groupId !== '__MANUAL_CHECK__' && sharedGroups[r.groupId]) {
      const sg = sharedGroups[r.groupId];
      clientShare = 1 / sg.clients.size;
      if (!sg.deductionCalculated) {
        const ded = calcDeduction(payoutDate, dedBasis, r.insuranceYearsCovered, isHcEligible, false, yr, mo, r.containerType, !!rr);
        sg.deductionAmount = ded.amount; sg.deductionItems = ded.items; sg.deductionCalculated = true;
      }
      const splitItems = sg.deductionItems.map(it => ({ ...it, amount: it.amount * clientShare }));
      g.totalDeduction += sg.deductionAmount * clientShare;
      g.deductionItems.push(...splitItems);
      if (sg.deductionAmount > 0) g.notes.push(`Shared container — deduction split ${sg.clients.size} ways`);
    } else {
      const ded = calcDeduction(payoutDate, dedBasis, r.insuranceYearsCovered, isHcEligible, false, yr, mo, r.containerType, !!rr);
      g.totalDeduction += ded.amount * clientShare;
      g.deductionItems.push(...ded.items.map(it => ({ ...it, amount: it.amount * clientShare })));
    }
  });

  results = Object.values(groups)
    .filter(g => g.totalDeduction > 0)
    .sort((a, b) => a.index - b.index)
    .map(g => {
      const dedNotes = [];
      const byType = {};
      g.deductionItems.forEach(it => {
        if (!byType[it.type]) byType[it.type] = 0;
        byType[it.type] += it.amount;
      });
      ['Y1 Insurance','Y2 Insurance','Y3 Insurance','HC'].forEach(t => {
        if (byType[t]) dedNotes.push(`${t.replace(' Insurance',' IP')} — AED ${fmt(byType[t])}`);
      });
      const allNotes = [...new Set(g.notes), ...dedNotes].join(' | ');

      // Email match
      const em = lookupEmail(g.clientName);
      const [emEmail1, emEmail2] = em ? splitEmails(em.clientEmailRaw) : ['', ''];

      return {
        ...g, totalDeduction: Math.round(g.totalDeduction), note: allNotes,
        emailSheetClientName: em ? em.emailSheetClientName : '',
        email1: emEmail1, email2: emEmail2,
        mobile: em ? em.mobile : '',
        nationality: em ? em.nationality : '',
        eid: em ? em.eid : '',
      };
    });

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
      <td class="td-center td-mono">${r.containers.length}</td>
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

  const headers = ['CLIENT NAME',
    'CLIENT NAME (EMAIL SHEET)','EMAIL 1','EMAIL 2','MOBILE','NATIONALITY','EID/PASSPORT/NATIONAL CARD',
    'IBAN','ACCOUNT NUMBER','UNITS','DEDUCTION (AED)','NOTES'];
  const rows = results.map(r => [
    r.clientName,
    r.emailSheetClientName || '', r.email1 || '', r.email2 || '', r.mobile || '', r.nationality || '', r.eid || '',
    r.iban || '', r.accountNo || '',
    r.containers.length, r.totalDeduction, r.note || '',
  ]);

  const totDeduct = results.reduce((s,r) => s + r.totalDeduction, 0);
  rows.push(['TOTAL','','','','','','','','','',totDeduct,'']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{wch:45},{wch:45},{wch:30},{wch:30},{wch:16},{wch:16},{wch:24},{wch:30},{wch:22},{wch:8},{wch:16},{wch:60}];
  XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[mo-1]} ${yr} IP Deduction`.substring(0, 31));
  XLSX.writeFile(wb, getExpectedOutputFilename());
}
