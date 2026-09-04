// ─────────────────────────────────────────────────────────────────
// PDF EDITOR PHASE 3 — pdf-editor-phase3.js
// Document <-> PDF (basic, text/tables only) and Compress (basic)
// Depends on: pdf-lib (PDFLib), pdf.js (pdfjsLib), SheetJS (XLSX),
//             mammoth (window.mammoth), docx (window.docx)
// Uses peFmtBytes / peDownloadBlob from pdf-editor-tools.js
//
// SCOPE NOTE: "basic" means text and simple tables only — no fonts,
// styles, images, or complex layout are preserved in either direction.
// ─────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
// DOCUMENT <-> PDF
// ═══════════════════════════════════════════════════════════════
window.PdfDocs = (() => {
  let toPdfFile = null;
  let fromPdfFile = null;

  function init(mountId) {
    const el = document.getElementById(mountId);
    if (!el) return;
    el.innerHTML = `
      <div class="mode-tabs" id="pdSubTabs" style="margin-bottom:1rem;">
        <button class="mode-tab active" data-sub="toPdf">Word / Excel &#8594; PDF</button>
        <button class="mode-tab" data-sub="fromPdf">PDF &#8594; Word / Excel</button>
      </div>

      <div id="pdToPdf">
        <div class="card">
          <div class="section-label">Document to convert</div>
          <p class="card-hint">Basic conversion only &mdash; text and simple tables. Fonts, styling, images, and complex layout are not preserved.</p>
          <div class="upload-zone" id="pdToPdfDropZone">
            <input type="file" id="pdToPdfFileInput" accept=".docx,.xlsx,.xls" />
            <div class="upload-zone-text">
              <strong>Drop a .docx or .xlsx file here or click to browse</strong>
            </div>
          </div>
          <div class="file-loaded" id="pdToPdfFileLoaded">
            <span>&#10003;</span>
            <div>
              <div class="file-loaded-name" id="pdToPdfLoadedName">&mdash;</div>
              <div class="file-loaded-meta" id="pdToPdfLoadedMeta">&mdash;</div>
            </div>
          </div>
          <div class="msg" id="pdToPdfMsg"></div>
        </div>
        <div class="card action-card" id="pdToPdfActions" style="display:none;">
          <button class="btn-primary" id="pdToPdfBtn">&#8595; Convert to PDF</button>
          <div class="msg" id="pdToPdfResultMsg"></div>
        </div>
      </div>

      <div id="pdFromPdf" style="display:none;">
        <div class="card">
          <div class="section-label">PDF to convert</div>
          <p class="card-hint">Extracts text only &mdash; layout, fonts, and images are not carried over.</p>
          <div class="upload-zone" id="pdFromPdfDropZone">
            <input type="file" id="pdFromPdfFileInput" accept=".pdf" />
            <div class="upload-zone-text">
              <strong>Drop a PDF here or click to browse</strong>
            </div>
          </div>
          <div class="file-loaded" id="pdFromPdfFileLoaded">
            <span>&#10003;</span>
            <div>
              <div class="file-loaded-name" id="pdFromPdfLoadedName">&mdash;</div>
              <div class="file-loaded-meta" id="pdFromPdfLoadedMeta">&mdash;</div>
            </div>
          </div>
          <div class="msg" id="pdFromPdfMsg"></div>
        </div>
        <div class="card action-card" id="pdFromPdfActions" style="display:none;">
          <div class="btn-row" style="display:flex;gap:10px;">
            <button class="btn-primary" id="pdToDocxBtn">&#8595; Export as Word (.docx)</button>
            <button class="btn-primary" id="pdToXlsxBtn">&#8595; Export as Excel (.xlsx)</button>
          </div>
          <div class="msg" id="pdFromPdfResultMsg"></div>
        </div>
      </div>
    `;

    toPdfFile = null;
    fromPdfFile = null;

    document.querySelectorAll('#pdSubTabs .mode-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#pdSubTabs .mode-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('pdToPdf').style.display = btn.dataset.sub === 'toPdf' ? '' : 'none';
        document.getElementById('pdFromPdf').style.display = btn.dataset.sub === 'fromPdf' ? '' : 'none';
      });
    });

    const toDrop = document.getElementById('pdToPdfDropZone');
    const toInput = document.getElementById('pdToPdfFileInput');
    ['dragenter', 'dragover'].forEach(evt => toDrop.addEventListener(evt, e => { e.preventDefault(); toDrop.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(evt => toDrop.addEventListener(evt, e => { e.preventDefault(); toDrop.classList.remove('dragover'); }));
    toDrop.addEventListener('drop', e => loadToPdfFile(e.dataTransfer.files[0]));
    toInput.addEventListener('change', () => loadToPdfFile(toInput.files[0]));
    document.getElementById('pdToPdfBtn').addEventListener('click', convertToPdf);

    const fromDrop = document.getElementById('pdFromPdfDropZone');
    const fromInput = document.getElementById('pdFromPdfFileInput');
    ['dragenter', 'dragover'].forEach(evt => fromDrop.addEventListener(evt, e => { e.preventDefault(); fromDrop.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(evt => fromDrop.addEventListener(evt, e => { e.preventDefault(); fromDrop.classList.remove('dragover'); }));
    fromDrop.addEventListener('drop', e => loadFromPdfFile(e.dataTransfer.files[0]));
    fromInput.addEventListener('change', () => loadFromPdfFile(fromInput.files[0]));
    document.getElementById('pdToDocxBtn').addEventListener('click', () => exportFromPdf('docx'));
    document.getElementById('pdToXlsxBtn').addEventListener('click', () => exportFromPdf('xlsx'));
  }

  function loadToPdfFile(file) {
    if (!file) return;
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['docx', 'xlsx', 'xls'].includes(ext)) {
      const m = document.getElementById('pdToPdfMsg');
      m.textContent = 'Please select a .docx or .xlsx file.';
      m.className = 'msg show error';
      return;
    }
    toPdfFile = { file, ext };
    document.getElementById('pdToPdfFileLoaded').classList.add('show');
    document.getElementById('pdToPdfLoadedName').textContent = file.name;
    document.getElementById('pdToPdfLoadedMeta').textContent = peFmtBytes(file.size);
    document.getElementById('pdToPdfActions').style.display = '';
  }

  // ── Text layout helper: wraps text into lines that fit maxWidth ──
  function wrapLines(text, font, size, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    words.forEach(word => {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  async function convertToPdf() {
    if (!toPdfFile) return;
    const btn = document.getElementById('pdToPdfBtn');
    btn.disabled = true;
    btn.textContent = 'Converting\u2026';
    try {
      const doc = await PDFLib.PDFDocument.create();
      const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      const margin = 50;
      const fontSize = 11;
      const lineHeight = fontSize * 1.4;

      if (toPdfFile.ext === 'docx') {
        if (!window.mammoth) throw new Error('mammoth.js did not load — check the CDN script tag');
        const arrayBuffer = await toPdfFile.file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const paragraphs = result.value.split(/\n+/).filter(p => p.trim());

        let page = doc.addPage();
        let { width, height } = page.getSize();
        let y = height - margin;

        paragraphs.forEach(para => {
          const lines = wrapLines(para, font, fontSize, width - margin * 2);
          lines.forEach(line => {
            if (y < margin) {
              page = doc.addPage();
              ({ width, height } = page.getSize());
              y = height - margin;
            }
            page.drawText(line, { x: margin, y, size: fontSize, font });
            y -= lineHeight;
          });
          y -= lineHeight * 0.6; // paragraph gap
        });
      } else {
        const arrayBuffer = await toPdfFile.file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        let page = doc.addPage([842, 595]); // landscape A4, tables tend to be wide
        let { width, height } = page.getSize();
        let y = height - margin;
        const colCount = Math.max(1, ...rows.map(r => r.length));
        const colWidth = (width - margin * 2) / colCount;
        const rowHeight = 18;
        const cellFontSize = 8;

        rows.forEach(row => {
          if (y < margin + rowHeight) {
            page = doc.addPage([842, 595]);
            ({ width, height } = page.getSize());
            y = height - margin;
          }
          row.forEach((cell, c) => {
            const text = String(cell).slice(0, 40);
            page.drawText(text, { x: margin + c * colWidth + 3, y: y - 12, size: cellFontSize, font });
          });
          page.drawLine({ start: { x: margin, y: y - rowHeight + 4 }, end: { x: width - margin, y: y - rowHeight + 4 }, thickness: 0.5, color: PDFLib.rgb(0.8, 0.8, 0.8) });
          y -= rowHeight;
        });
      }

      const bytes = await doc.save();
      const baseName = toPdfFile.file.name.replace(/\.\w+$/, '');
      peDownloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName}.pdf`);
      const m = document.getElementById('pdToPdfResultMsg');
      m.textContent = 'Downloaded.';
      m.className = 'msg show info';
    } catch (err) {
      const m = document.getElementById('pdToPdfResultMsg');
      m.textContent = `Failed: ${err.message}`;
      m.className = 'msg show error';
    } finally {
      btn.disabled = false;
      btn.textContent = '\u2193 Convert to PDF';
    }
  }

  async function loadFromPdfFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) return;
    fromPdfFile = file;
    document.getElementById('pdFromPdfFileLoaded').classList.add('show');
    document.getElementById('pdFromPdfLoadedName').textContent = file.name;
    document.getElementById('pdFromPdfLoadedMeta').textContent = peFmtBytes(file.size);
    document.getElementById('pdFromPdfActions').style.display = '';
  }

  async function extractPdfLines() {
    const bytes = await fromPdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      let currentY = null;
      let currentLine = '';
      content.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (currentY === null || Math.abs(y - currentY) > 3) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = item.str;
          currentY = y;
        } else {
          currentLine += item.str;
        }
      });
      if (currentLine.trim()) lines.push(currentLine.trim());
      lines.push(''); // page break marker
    }
    return lines;
  }

  async function exportFromPdf(format) {
    if (!fromPdfFile) return;
    const btn = format === 'docx' ? document.getElementById('pdToDocxBtn') : document.getElementById('pdToXlsxBtn');
    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = 'Exporting\u2026';
    try {
      const lines = await extractPdfLines();
      const baseName = fromPdfFile.name.replace(/\.pdf$/i, '');

      if (format === 'docx') {
        if (!window.docx) throw new Error('docx library did not load — check the CDN script tag');
        const { Document, Packer, Paragraph } = window.docx;
        const paragraphs = lines.map(line => new Paragraph(line));
        const document_ = new Document({ sections: [{ children: paragraphs }] });
        const blob = await Packer.toBlob(document_);
        peDownloadBlob(blob, `${baseName}.docx`);
      } else {
        const wb = XLSX.utils.book_new();
        const rows = lines.map(line => [line]);
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        peDownloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), `${baseName}.xlsx`);
      }
      const m = document.getElementById('pdFromPdfResultMsg');
      m.textContent = 'Downloaded.';
      m.className = 'msg show info';
    } catch (err) {
      const m = document.getElementById('pdFromPdfResultMsg');
      m.textContent = `Failed: ${err.message}`;
      m.className = 'msg show error';
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  return { init };
})();

// ═══════════════════════════════════════════════════════════════
// COMPRESS (basic)
// ═══════════════════════════════════════════════════════════════
// True compression needs re-encoding embedded images at lower quality.
// pdf-lib can't walk/replace image XObjects directly, so this works by
// rasterizing each page (via pdf.js) and re-embedding as a JPEG at a
// chosen quality. This gives real, visible size reduction, but pages
// become images: text is no longer selectable/searchable afterward.
// Best for scanned/image-heavy PDFs, not for text-heavy documents.
// ═══════════════════════════════════════════════════════════════
window.PdfCompress = (() => {
  let loaded = null;

  function init(mountId) {
    const el = document.getElementById(mountId);
    if (!el) return;
    el.innerHTML = `
      <div class="card" id="cpUploadCard">
        <div class="section-label">Compress</div>
        <p class="card-hint">Rasterizes each page and re-saves it as a compressed image. This shrinks file size but text stops being selectable/searchable afterward &mdash; best for scanned or image-heavy PDFs.</p>
        <div class="upload-zone" id="cpDropZone">
          <input type="file" id="cpFileInput" accept=".pdf" />
          <div class="upload-zone-text">
            <strong>Drop a PDF here or click to browse</strong>
          </div>
        </div>
        <div class="file-loaded" id="cpFileLoaded">
          <span>&#10003;</span>
          <div>
            <div class="file-loaded-name" id="cpLoadedName">&mdash;</div>
            <div class="file-loaded-meta" id="cpLoadedMeta">&mdash;</div>
          </div>
        </div>
        <div class="msg" id="cpMsg"></div>
      </div>

      <div class="card" id="cpOptionsCard" style="display:none;">
        <div class="section-label">Compression level</div>
        <div class="selector-row">
          <div class="selector-group">
            <label>Level</label>
            <select id="cpLevel">
              <option value="0.75|1.5">Balanced (recommended)</option>
              <option value="0.5|1">Smaller file size</option>
              <option value="0.35|0.75">Smallest (lower quality)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card action-card" id="cpActionsCard" style="display:none;">
        <button class="btn-primary" id="cpApplyBtn">&#8595; Compress and download</button>
        <div class="msg" id="cpApplyMsg"></div>
      </div>
    `;

    loaded = null;

    const dropZone = document.getElementById('cpDropZone');
    const fileInput = document.getElementById('cpFileInput');
    ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
    dropZone.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
    fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
    document.getElementById('cpApplyBtn').addEventListener('click', apply);
  }

  async function loadFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) return;
    loaded = { file };
    document.getElementById('cpFileLoaded').classList.add('show');
    document.getElementById('cpLoadedName').textContent = file.name;
    document.getElementById('cpLoadedMeta').textContent = peFmtBytes(file.size);
    document.getElementById('cpOptionsCard').style.display = '';
    document.getElementById('cpActionsCard').style.display = '';
  }

  async function apply() {
    if (!loaded) return;
    const btn = document.getElementById('cpApplyBtn');
    btn.disabled = true;
    btn.textContent = 'Compressing\u2026';
    try {
      const [quality, scale] = document.getElementById('cpLevel').value.split('|').map(Number);
      const bytes = await loaded.file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
      const outDoc = await PDFLib.PDFDocument.create();

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        const jpegBytes = Uint8Array.from(atob(jpegDataUrl.split(',')[1]), c => c.charCodeAt(0));
        const embedded = await outDoc.embedJpg(jpegBytes);
        const outPage = outDoc.addPage([embedded.width, embedded.height]);
        outPage.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
      }

      const outBytes = await outDoc.save();
      const baseName = loaded.file.name.replace(/\.pdf$/i, '');
      peDownloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName}_compressed.pdf`);

      const m = document.getElementById('cpApplyMsg');
      const before = peFmtBytes(loaded.file.size);
      const after = peFmtBytes(outBytes.length);
      m.textContent = `Downloaded. ${before} \u2192 ${after}`;
      m.className = 'msg show info';
    } catch (err) {
      const m = document.getElementById('cpApplyMsg');
      m.textContent = `Failed: ${err.message}`;
      m.className = 'msg show error';
    } finally {
      btn.disabled = false;
      btn.textContent = '\u2193 Compress and download';
    }
  }

  return { init };
})();
