// ─────────────────────────────────────────────────────────────────
// PDF EDITOR — pdf-editor.js
// Top-level controller: tab switching, footer, lazy module init.
// Tool logic lives in pdf-editor-tools.js (PdfMerge, PdfWatermark, PdfImages).
// Depends on: pdf-lib (PDFLib), pdf.js (pdfjsLib), JSZip
// ─────────────────────────────────────────────────────────────────

let peActiveMode = 'merge';
const PE_COMING_SOON = {
  editText: 'Edit text (whiteout + replace) — coming in Phase 2.',
  ocr: 'OCR (Tesseract.js) — coming in Phase 2.',
  docs: 'Document \u2194 PDF (basic, text/tables only) — coming in Phase 3.',
  compress: 'Compress — coming in Phase 3.',
  password: 'Password protect / remove — coming in Phase 3 (limited support).',
};

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
  const comingSoonMount = document.getElementById('comingSoonMount');
  const comingSoonText  = document.getElementById('comingSoonText');

  mergeMount.style.display     = peActiveMode === 'merge' ? '' : 'none';
  watermarkMount.style.display = peActiveMode === 'watermark' ? '' : 'none';
  imagesMount.style.display    = peActiveMode === 'images' ? '' : 'none';

  const isComingSoon = Object.prototype.hasOwnProperty.call(PE_COMING_SOON, peActiveMode);
  comingSoonMount.style.display = isComingSoon ? '' : 'none';
  if (isComingSoon) comingSoonText.textContent = PE_COMING_SOON[peActiveMode];

  if (peActiveMode === 'watermark' && window.PdfWatermark && !watermarkMount.dataset.inited) {
    PdfWatermark.init('watermarkMount');
    watermarkMount.dataset.inited = '1';
  }
  if (peActiveMode === 'images' && window.PdfImages && !imagesMount.dataset.inited) {
    PdfImages.init('imagesMount');
    imagesMount.dataset.inited = '1';
  }
}
