// ─────────────────────────────────────────────────────────────────
// NOTES — notes.js
// Every static note/flag string shown in a Notes column, in one place.
// Wording is unchanged from where each one used to live inline — this
// file only moves them, it doesn't reword anything. Edit the text here
// and it applies everywhere that note is used.
// Depends on: nothing. Loaded before shared.js and payout.js.
// ─────────────────────────────────────────────────────────────────
const Notes = {

  // ── app.js — per-row flag built while parsing the Payment Info Sheet ──
  contractClosedFlag: (value) =>
    `⚑ Contract Closed field: "${value}" — review`,

  // ── shared.js — per-client flags (calcPayeeDeductions) ──
  noContractOrContainer: () =>
    '⚑ No container or contract number — manual check required',

  contractEndPassed: () =>
    '⚑ Contract end date has passed — verify',

  yearlyOrQuarterlyPayout: (freq) =>
    `⚑ ${freq === 'yearly' ? 'Yearly' : 'Quarterly'} payout — verify rental amount with accounts`,

  yearlyPayoutStartUnconfirmed: () =>
    '⚑ Yearly payout — start date not yet confirmed, verify with accounts',

  sharedGroupSplit: (groupId, splitLabel) =>
    `⚑ Shared group ${groupId} — deduction split ${splitLabel}`,

  allContainersTerminated: () =>
    '⚑ All containers marked for termination — no payout this cycle',

  partialContainersTerminated: (terminatedCount, totalCount) =>
    `⚑ ${terminatedCount} of ${totalCount} container(s) marked for termination — excluded from this payout`,

  // shared.js's own deduction note (uncapped totals) — used by the IP
  // Deduction tool's Notes column, via g.note.
  dedNoteTotal: (total, label, containers) =>
    `${total.toLocaleString()}AED total deduction for ${label} | ${containers.join(', ')}`,

  // ── payout.js — Payout Generator's own split/carryover notes ──
  splitDeductedFullyCollected: (pay, label, container, installmentLabel) =>
    `${pay.toLocaleString()} AED deducted for ${label} -${container} (${installmentLabel}) — fully collected`,

  splitDeductedRemaining: (pay, label, container, installmentLabel, remaining) =>
    `${pay.toLocaleString()} AED deducted for ${label} -${container} (${installmentLabel}) — ${remaining.toLocaleString()} AED remaining, continue next cycle`,

  consolidatedDeduction: (amount, label, containers) =>
    `${amount.toLocaleString()} AED deduction for ${label} | ${containers.join(', ')}`,

  rentalInUSD: () =>
    '⚑ Rental amount is in USD — verify AED conversion',

  // File-level summary lines, shown once above the export (not per-client)
  sharedGroupsSummary: (count, names) =>
    `⚑ ${count} shared group(s) — deduction split: ${names}`,

  duplicateContainerMismatch: (container, contractNos, clientNames) =>
    `🔴 Duplicate container mismatch: ${container} — contracts ${contractNos.join(' / ')} — clients: ${clientNames.join(' / ')} — manual check required`,

  carriedToNextCycleSummary: (count) =>
    `⚑ ${count} payee(s) with a deduction carried to next cycle — upload this export as next cycle's reference file to continue collecting`,

};
