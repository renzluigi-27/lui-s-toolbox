// ─────────────────────────────────────────────────────────────────
// PDF EDITOR — pdf-editor.js
// Top-level controller: tab switching, footer, lazy module init.
// Tool logic lives in:
//   pdf-editor-tools.js  — PdfMerge, PdfWatermark, PdfImages
//   eml-to-pdf.js         — EmlToPdf
//   pdf-editor-phase2.js  — PdfEditText, PdfOcr
//   pdf-editor-phase3.js  — PdfDocs, PdfCompress
// Depends on: pdf-lib (PDFLib), pdf.js (pdfjsLib), JSZip
// ─────────────────────────────────────────────────────────────────

let peActiveMode = 'merge';

document.addEventListener('DOMContentLoaded', () => {
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === peActiveMode) return;
      document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      peActiveMode = btn.dataset.mode;
      peUpdateTabUI();
    });
  });

  if (window.PdfMerge) PdfMerge.init('mergeMount');

  fetch('/components/footer.html')
    .then(r => r.text())
    .then(h => { document.getElementById('footer').innerHTML = h; })
    .catch(() => {});
});

function peUpdateTabUI() {
  const mergeMount     = document.getElementById('mergeMount');
  const watermarkMount = document.getElementById('watermarkMount');
  const imagesMount    = document.getElementById('imagesMount');
  const emlToPdfMount  = document.getElementById('emlToPdfMount');
  const editTextMount  = document.getElementById('editTextMount');
  const ocrMount       = document.getElementById('ocrMount');
  const docsMount      = document.getElementById('docsMount');
  const compressMount  = document.getElementById('compressMount');

  mergeMount.style.display     = peActiveMode === 'merge' ? '' : 'none';
  watermarkMount.style.display = peActiveMode === 'watermark' ? '' : 'none';
  imagesMount.style.display    = peActiveMode === 'images' ? '' : 'none';
  emlToPdfMount.style.display  = peActiveMode === 'emlToPdf' ? '' : 'none';
  editTextMount.style.display  = peActiveMode === 'editText' ? '' : 'none';
  ocrMount.style.display       = peActiveMode === 'ocr' ? '' : 'none';
  docsMount.style.display      = peActiveMode === 'docs' ? '' : 'none';
  compressMount.style.display  = peActiveMode === 'compress' ? '' : 'none';

  if (peActiveMode === 'watermark' && window.PdfWatermark && !watermarkMount.dataset.inited) {
    PdfWatermark.init('watermarkMount');
    watermarkMount.dataset.inited = '1';
  }
  if (peActiveMode === 'images' && window.PdfImages && !imagesMount.dataset.inited) {
    PdfImages.init('imagesMount');
    imagesMount.dataset.inited = '1';
  }
  if (peActiveMode === 'emlToPdf' && window.EmlToPdf && !emlToPdfMount.dataset.inited) {
    EmlToPdf.init('emlToPdfMount');
    emlToPdfMount.dataset.inited = '1';
  }
  if (peActiveMode === 'editText' && window.PdfEditText && !editTextMount.dataset.inited) {
    PdfEditText.init('editTextMount');
    editTextMount.dataset.inited = '1';
  }
  if (peActiveMode === 'ocr' && window.PdfOcr && !ocrMount.dataset.inited) {
    PdfOcr.init('ocrMount');
    ocrMount.dataset.inited = '1';
  }
  if (peActiveMode === 'docs' && window.PdfDocs && !docsMount.dataset.inited) {
    PdfDocs.init('docsMount');
    docsMount.dataset.inited = '1';
  }
  if (peActiveMode === 'compress' && window.PdfCompress && !compressMount.dataset.inited) {
    PdfCompress.init('compressMount');
    compressMount.dataset.inited = '1';
  }
}
