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
    '⚑ No container or contract number',

  contractEndPassed: () =>
    '⚑ Contract end date has passed',

  yearlyOrQuarterlyPayout: (freq) =>
    `⚑ ${freq === 'yearly' ? 'Yearly' : 'Quarterly'} payout`,

  yearlyPayoutStartUnconfirmed: () =>
    '⚑ Yearly payout',

  sharedGroupSplit: (groupId, splitLabel) =>
    `⚑ Shared group ${groupId} — deduction split ${splitLabel}`,

  allContainersTerminated: () =>
    '⚑ All containers marked for termination',

  partialContainersTerminated: (terminatedCount, totalCount) =>
    `⚑ ${terminatedCount} of ${totalCount} container(s) marked for termination`,

  // shared.js's own deduction note (uncapped totals) — used by the IP
  // Deduction tool's Notes column, via g.note.
  dedNoteEach: (amount, label, containers) =>
    `${amount.toLocaleString()}AED each for ${label} | ${containers.join(', ')}`,

  // ── payout.js — Payout Generator's own split/carryover notes ──
  splitDeductedFullyCollected: (pay, label, container, installmentLabel) =>
    `${pay.toLocaleString()} AED deducted for ${label} -${container} (${installmentLabel})`,

  splitDeductedRemaining: (pay, label, container, installmentLabel, remaining) =>
    `${pay.toLocaleString()} AED deducted for ${label} -${container} (${installmentLabel}) — ${remaining.toLocaleString()} AED remaining`,

  consolidatedDeduction: (amount, label, containers) =>
    `${amount.toLocaleString()} AED deduction for ${label} | ${containers.join(', ')}`,

  rentalInUSD: () =>
    '⚑ Rental amount is in USD',

  // File-level summary lines, shown once above the export (not per-client)
  sharedGroupsSummary: (count, names) =>
    `⚑ ${count} shared group(s) — deduction split: ${names}`,

  duplicateContainerMismatch: (container, contractNos, clientNames) =>
    `🔴 Duplicate container mismatch: ${container} — contracts ${contractNos.join(' / ')} — clients: ${clientNames.join(' / ')} — manual check required`,

  carriedToNextCycleSummary: (count) =>
    `⚑ ${count} payee(s) with a deduction carried to next cycle — upload this export as next cycle's reference file to continue collecting`,

};
