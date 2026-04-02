function field(label, value, mono, full) {
  return `<div class="field${full ? ' full' : ''}">
    <div class="field-label">${label}</div>
    <div class="field-value${mono ? ' mono' : ''}">${value}</div>
  </div>`;
}

function checkBank() {
  const account = document.getElementById('accountInput').value.trim();
  const ifsc = document.getElementById('ifscInput').value.trim().toUpperCase();

  const resultDiv = document.getElementById('result');
  const badge = document.getElementById('statusBadge');
  const ifscFmt = document.getElementById('ifscFormatted');
  const errorMsg = document.getElementById('errorMsg');
  const fieldsDiv = document.getElementById('detailFields');

  resultDiv.style.display = 'block';
  errorMsg.style.display = 'none';
  fieldsDiv.innerHTML = '';
  ifscFmt.textContent = ifsc;

  if (!account || !ifsc) {
    badge.className = 'badge badge-invalid';
    badge.innerHTML = '<span class="badge-dot"></span>Invalid';
    ifscFmt.textContent = '';
    errorMsg.textContent = 'Please enter both account number and IFSC code.';
    errorMsg.style.display = 'block';
    return;
  }

  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(ifsc)) {
    badge.className = 'badge badge-invalid';
    badge.innerHTML = '<span class="badge-dot"></span>Invalid';
    errorMsg.textContent = 'Invalid IFSC format. Expected format: ABCD0123456 (11 characters).';
    errorMsg.style.display = 'block';
    return;
  }

  const bankCode = ifsc.substring(0, 4);
  const bank = INDIA_BANKS[bankCode];

  badge.className = 'badge badge-valid';
  badge.innerHTML = '<span class="badge-dot"></span>Format Valid';

  let html = '';
  html += field('Account Number', account, true, true);
  html += field('IFSC Code', ifsc, true);
  html += field('Bank Code', bankCode, true);

  if (bank) {
    html += field('Bank Name', bank.name, false, true);
    html += field('Branch', bank.branch || 'Not available', false);
    html += field('Address', bank.address || 'Not available', false, true);
    html += field('SWIFT / BIC', bank.swift || 'Not available', true);
  } else {
    html += field('Bank Name', 'Bank not found in registry', false, true);
    html += field('Branch', 'Not available', false);
    html += field('Address', 'Not available', false, true);
    html += field('SWIFT / BIC', 'Not available', true);
  }

  fieldsDiv.innerHTML = html;
}

document.getElementById('ifscInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') checkBank();
});
document.getElementById('accountInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') checkBank();
});
