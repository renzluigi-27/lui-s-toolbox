function validateIFSC(ifsc) {
  return /^[A-Z]{4}0[0-9]{6}$/.test(ifsc);
}

function maskAccount(account) {
  if (account.length <= 4) return account;
  return "XXXXXX" + account.slice(-4);
}

function checkBank() {
  const account = document.getElementById("account").value.trim();
  const ifsc = document.getElementById("ifsc").value.trim().toUpperCase();
  const resultBox = document.getElementById("result");
  const resultText = document.getElementById("resultText");

  // Reset
  resultBox.style.display = "block";
  resultBox.classList.remove("valid", "invalid");

  if (!account || !ifsc) {
    resultBox.classList.add("invalid");
    resultText.textContent = "Please enter account number and IFSC code.";
    return;
  }

  // Validate IFSC format
  if (!validateIFSC(ifsc)) {
    resultBox.classList.add("invalid");
    resultText.textContent = "Invalid IFSC format.";
    return;
  }

  // Lookup bank
  const bank = INDIA_BANKS[ifsc];

  if (!bank) {
    resultBox.classList.add("invalid");
    resultText.textContent = "IFSC not found in database.";
    return;
  }

  // Valid
  resultBox.classList.add("valid");
  resultText.textContent =
`Status: VALID

Bank: ${bank.bank}
Branch: ${bank.branch}
Address: ${bank.address}
SWIFT: ${bank.swift || "N/A"}
Account: ${maskAccount(account)}
IFSC: ${ifsc}`;
}
