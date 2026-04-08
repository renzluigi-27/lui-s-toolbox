function validateFile(inputId, cardId, nameId, requiredName) {
  const fileInput = document.getElementById(inputId);
  const file = fileInput.files[0];
  if (!file) return;

  const nameBox = document.getElementById(nameId);
  const card = document.getElementById(cardId);

  if (file.name !== requiredName) {
    nameBox.textContent = "✗ Wrong file name";
    nameBox.style.color = "#E24B4A";
    card.classList.remove("has-file");
    fileInput.value = "";
    return;
  }

  card.classList.add("has-file");
  nameBox.textContent = "✓ " + file.name;
  nameBox.style.color = "#639922";
}

document.getElementById('file1').addEventListener('change', function() {
  validateFile("file1", "card1", "name1", "payment info sheet.xlsx");
});

document.getElementById('file2').addEventListener('change', function() {
  validateFile("file2", "card2", "name2", "deduction list.xlsx");
});

  fetch('/components/footer.html')
    .then(res => res.text())
    .then(data => {
      document.getElementById('footer').innerHTML = data;
    });
  
