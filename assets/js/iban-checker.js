const WORKER_URL = 'https://renzluigi.pages.dev/api/iban';



function mod97(iban) {
  const reordered = iban.slice(4) + iban.slice(0, 4);
  const numeric = reordered.split('').map(c => {
    const code = c.charCodeAt(0);
    return code >= 65 && code <= 90 ? (code - 55).toString() : c;
  }).join('');
  let rem = 0;
  for (let i = 0; i < numeric.length; i++) rem = (rem * 10 + parseInt(numeric[i])) % 97;
  return rem;
}

function formatIBAN(iban) { return iban.replace(/(.{4})/g, '$1 ').trim(); }

function field(label, value, mono, full) {
  return `<div class="field${full ? ' full' : ''}"><div class="field-label">${label}</div><div class="field-value${mono ? ' mono' : ''}">${value}</div></div>`;
}

function checkIBAN() {
  const raw = document.getElementById('ibanInput').value.replace(/[\s\u200E\u200F\u200B\uFEFF]/g, '').toUpperCase();
  const resultDiv = document.getElementById('result');
  const badge = document.getElementById('statusBadge');
  const ibanFmt = document.getElementById('ibanFormatted');
  const errorMsg = document.getElementById('errorMsg');
  const fieldsDiv = document.getElementById('detailFields');

  resultDiv.style.display = 'block';
  errorMsg.style.display = 'none';
  fieldsDiv.innerHTML = '';

  if (!raw) {
    badge.className = 'badge badge-invalid';
    badge.innerHTML = '<span class="badge-dot"></span>Invalid';
    ibanFmt.textContent = '';
    errorMsg.textContent = 'Please enter an IBAN.';
    errorMsg.style.display = 'block';
    return;
  }

  const cc = raw.slice(0, 2);
  const ci = COUNTRY_IBAN[cc];
  ibanFmt.textContent = formatIBAN(raw);

  if (!ci) {
    badge.className = 'badge badge-invalid';
    badge.innerHTML = '<span class="badge-dot"></span>Invalid';
    errorMsg.textContent = `Unknown country code "${cc}". This country may not use IBANs or the code is incorrect.`;
    errorMsg.style.display = 'block';
    return;
  }

  if (ci.noIBAN) {
    badge.className = 'badge badge-invalid';
    badge.innerHTML = '<span class="badge-dot"></span>Not Applicable';
    errorMsg.textContent = `${ci.country} does not use the IBAN system.`;
    errorMsg.style.display = 'block';
    return;
  }

  if (raw.length !== ci.len) {
    badge.className = 'badge badge-invalid';
    badge.innerHTML = '<span class="badge-dot"></span>Invalid';
    errorMsg.textContent = `Invalid length for ${ci.country}: expected ${ci.len} characters, got ${raw.length}.`;
    errorMsg.style.display = 'block';
    return;
  }

  const cs = mod97(raw);
  if (cs !== 1) {
    badge.className = 'badge badge-invalid';
    badge.innerHTML = '<span class="badge-dot"></span>Invalid';
    errorMsg.textContent = `Checksum failed (mod-97 result: ${cs}, expected: 1). The IBAN contains a typo or error.`;
    errorMsg.style.display = 'block';
    return;
  }

  badge.className = 'badge badge-valid';
  badge.innerHTML = '<span class="badge-dot"></span>Valid';

  let html = '';
  html += field('Country', `<img src="https://flagcdn.com/16x12/${cc.toLowerCase()}.png" style="margin-right:6px;vertical-align:middle;">${ci.country}`, false);
  html += field('Check Digits', raw.slice(2, 4), true);

  if (cc === 'AE') {
    const bankCode = raw.slice(4, 7);
    const account  = raw.slice(7);
    const b = UAE_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', b.currency || 'AED', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'AED', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
} else if (cc === 'SA') {
    const bankCode = raw.slice(4, 6);
    const account  = raw.slice(6);
    const b = SA_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', 'SAR', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'SAR', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
} else if (cc === 'QA') {
    const bankCode = raw.slice(4, 8);
    const account  = raw.slice(8);
    const b = QA_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', 'QAR', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'QAR', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
} else if (cc === 'KW') {
    const bankCode = raw.slice(4, 8);
    const account  = raw.slice(8);
    const b = KW_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', 'KWD', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'KWD', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
} else if (cc === 'BH') {
    const bankCode = raw.slice(4, 8);
    const account  = raw.slice(8);
    const b = BH_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', 'BHD', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'BHD', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
} else if (cc === 'OM') {
    const bankCode = raw.slice(4, 7);
    const account  = raw.slice(7);
    const b = OM_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', 'OMR', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'OMR', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
} else if (cc === 'JO') {
    const bankCode = raw.slice(4, 8);
    const account  = raw.slice(8);
    const b = JO_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', 'JOD', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'JOD', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
  } else if (cc === 'PK') {
    const bankCode = raw.slice(4, 8);
    const account  = raw.slice(8);
    const b = PK_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', 'PKR', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'PKR', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
  } else if (cc === 'EG') {
    const bankCode = raw.slice(4, 8);
    const account  = raw.slice(8);
    const b = EG_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', 'EGP', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'EGP', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
  } else if (cc === 'TR') {
    const bankCode = raw.slice(4, 9);
    const account  = raw.slice(9);
    const b = TR_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', 'TRY', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'TRY', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
  } else if (cc === 'GB') {
    const bankCode = raw.slice(4, 8).toUpperCase();
    const account  = raw.slice(8);
    const b = UK_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', 'GBP', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'GBP', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
  } else if (cc === 'BG') {
      const bankCode = raw.slice(4, 8);
      const account  = raw.slice(8);
      const b = BG_BANKS[bankCode];
      html += field('Bank Code', bankCode, true);
      html += field('Account Number', account, true);
      if (b) {
        html += field('Bank Name', b.name, false, true);
        html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
        html += field('Currency', 'BGN', true);
        html += field('Head Office Address', b.address, false, true);
      } else {
        html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
        html += field('SWIFT / BIC', 'Not available', false);
        html += field('Currency', 'BGN', true);
        html += field('Head Office Address', 'Not available', false, true);
      }
  } else if (cc === 'BE') {
    const bankCode = raw.slice(4, 7);
    const account  = raw.slice(7);
    const b = BE_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', 'EUR', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'EUR', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
  } else if (cc === 'LT') {
    const bankCode = raw.slice(4, 9);
    const account  = raw.slice(9);
    const b = LT_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', 'EUR', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'EUR', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
  } else if (cc === 'ES') {
    const bankCode = raw.slice(4, 8);
    const account  = raw.slice(8);
    const b = ES_BANKS[bankCode];
    html += field('Bank Code', bankCode, true);
    html += field('Account Number', account, true);
    if (b) {
      html += field('Bank Name', b.name, false, true);
      html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
      html += field('Currency', 'EUR', true);
      html += field('Head Office Address', b.address, false, true);
    } else {
      html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
      html += field('SWIFT / BIC', 'Not available', false);
      html += field('Currency', 'EUR', true);
      html += field('Head Office Address', 'Not available', false, true);
    }
  } else if (cc === 'MT') {
      const bankCode = raw.slice(4, 8);
      const account  = raw.slice(8);
      const b = MT_BANKS[bankCode];
      html += field('Bank Code', bankCode, true);
      html += field('Account Number', account, true);
      if (b) {
        html += field('Bank Name', b.name, false, true);
        html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
        html += field('Currency', 'EUR', true);
        html += field('Head Office Address', b.address, false, true);
      } else {
        html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
        html += field('SWIFT / BIC', 'Not available', false);
        html += field('Currency', 'EUR', true);
        html += field('Head Office Address', 'Not available', false, true);
      }
  } else if (cc === 'CY') {
      const bankCode = raw.slice(4, 7);
      const branch   = raw.slice(7, 10);
      const account  = raw.slice(10);
      const b = CY_BANKS[bankCode];
      html += field('Bank Code', bankCode, true);
      html += field('Branch Code', branch, true);
      html += field('Account Number', account, true);
      if (b) {
        html += field('Bank Name', b.name, false, true);
        html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
        html += field('Currency', 'EUR', true);
        html += field('Head Office Address', b.address, false, true);
      } else {
        html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
        html += field('SWIFT / BIC', 'Not available', false);
        html += field('Currency', 'EUR', true);
        html += field('Head Office Address', 'Not available', false, true);
      }
  } else if (cc === 'NL') {
      const bankCode = raw.slice(4, 8);
      const account  = raw.slice(8);
      const b = NL_BANKS[bankCode];
      html += field('Bank Code', bankCode, true);
      html += field('Account Number', account, true);
      if (b) {
        html += field('Bank Name', b.name, false, true);
        html += field('SWIFT / BIC', b.swift !== 'N/A' ? b.swift : 'Not available', b.swift !== 'N/A');
        html += field('Currency', 'EUR', true);
        html += field('Head Office Address', b.address, false, true);
      } else {
        html += field('Bank Name', `Bank code ${bankCode} — not found in registry`, false, true);
        html += field('SWIFT / BIC', 'Not available', false);
        html += field('Currency', 'EUR', true);
        html += field('Head Office Address', 'Not available', false, true);
      }
  } else {
    const bban = raw.slice(4);
    const countryCurrency = ci.currency || 'Not available';

    html += field('BBAN', bban, true, true);
    html += field('Bank Name', '<span id="api-bank-name">Looking up...</span>', false, true);
    html += field('SWIFT / BIC', '<span id="api-swift">Looking up...</span>', true);
    html += field('Currency', '<span id="api-currency">Looking up...</span>', true);
    html += field('Head Office Address', '<span id="api-address">Looking up...</span>', false, true);

fetch(`${WORKER_URL}?iban=${raw}`)
  .then(r => r.json())
  .then(data => {
    document.getElementById('api-bank-name').textContent = data.bic?.name      || data.bic?.shortName || 'Not available';
    document.getElementById('api-swift').textContent     = data.bic?.bic       || 'Not available';
    document.getElementById('api-currency').textContent  = countryCurrency;
    document.getElementById('api-address').textContent   = 'Not provided by AnyAPI';
  })
  .catch(() => {
    document.getElementById('api-bank-name').textContent = 'API lookup failed';
    document.getElementById('api-swift').textContent     = 'API lookup failed';
    document.getElementById('api-currency').textContent  = countryCurrency;
    document.getElementById('api-address').textContent   = 'API lookup failed';
  });
  }

  fieldsDiv.innerHTML = html;
}

function useExample(iban) {
  document.getElementById('ibanInput').value = iban;
  checkIBAN();
}

document.getElementById('ibanInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') checkIBAN();
});

(function(){
const IN_DB = ['AE','SA','QA','KW','BH','OM','JO','TR','PK','EG','GB','BG','BE','LT','ES','MT','CY','NL'];
Object.entries(COUNTRY_IBAN).forEach(([code, c]) => {
  const chip = document.createElement('span');
  chip.className = 'example-chip';
  chip.innerHTML = `<img src="https://flagcdn.com/16x12/${code.toLowerCase()}.png" style="margin-right:5px;vertical-align:middle;">${c.country}`;
  if (c.noIBAN) {
    document.getElementById('noiban-countries').appendChild(chip);
  } else if (IN_DB.includes(code)) {
    document.getElementById('db-countries').appendChild(chip);
  } else {
    document.getElementById('soon-countries').appendChild(chip);
  }
});
})();
  

  fetch('/components/footer.html')
    .then(res => res.text())
    .then(data => {
      document.getElementById('footer').innerHTML = data;
    });
  
