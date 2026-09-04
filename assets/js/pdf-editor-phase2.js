// ─────────────────────────────────────────────────────────────────
// PDF EDITOR PHASE 2 — pdf-editor-phase2.js
// Edit text (whiteout + replace overlay) and OCR (Tesseract.js)
// Depends on: pdf-lib (PDFLib), pdf.js (pdfjsLib), Tesseract
// Uses peFmtBytes / peDownloadBlob from pdf-editor-tools.js
// ─────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
// EDIT TEXT — whiteout box + replacement text overlay
// ═══════════════════════════════════════════════════════════════
window.PdfEditText = (() => {
  let loaded = null;      // { file, bytes, pdfDoc, pageCount }
  let currentPage = 1;
  let edits = [];         // { page, type:'rect'|'text', xPts, yPts, wPts, hPts, text, size }
  let mode = null;        // 'rect' | 'text' | null
  let dragStart = null;
  let canvas, ctx, baseImageData;
  let scale = 1, pageWidthPts = 0, pageHeightPts = 0;

  const RENDER_WIDTH = 700;

  function init(mountId) {
    const el = document.getElementById(mountId);
    if (!el) return;
    el.innerHTML = `
      <div class="card" id="etUploadCard">
        <div class="section-label">Edit text (whiteout + replace)</div>
        <p class="card-hint">Covers existing text with a white box, then lets you type new text in its place. This does not truly edit the PDF's original text layer &mdash; no browser tool can do that reliably.</p>
        <div class="upload-zone" id="etDropZone">
          <input type="file" id="etFileInput" accept=".pdf" />
          <div class="upload-zone-text">
            <strong>Drop a PDF here or click to browse</strong>
            One file at a time
          </div>
        </div>
        <div class="msg" id="etMsg"></div>
      </div>

      <div id="etEditorCard" style="display:none;">
        <div class="card">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
            <button class="btn-secondary" id="etModeRect">Whiteout box</button>
            <button class="btn-secondary" id="etModeText">Add text</button>
            <button class="btn-secondary" id="etUndo">Undo last</button>
            <span style="flex:1;"></span>
            <button class="btn-secondary" id="etPrevPage">&#8592;</button>
            <span style="font-size:13px;color:var(--text-muted);" id="etPageLabel">Page 1 / 1</span>
            <button class="btn-secondary" id="etNextPage">&#8594;</button>
          </div>
          <div class="card-hint" id="etModeHint" style="margin-bottom:8px;">Pick a tool, then click or drag on the page below.</div>
          <div style="overflow:auto;border:0.5px solid var(--border);border-radius:8px;">
            <canvas id="etCanvas" style="display:block;cursor:crosshair;max-width:100%;"></canvas>
          </div>
          <div id="etEditList" style="margin-top:12px;"></div>
        </div>
        <div class="card action-card">
          <button class="btn-primary" id="etApplyBtn">&#8595; Apply and download</button>
          <div class="msg" id="etApplyMsg"></div>
        </div>
      </div>
    `;

    loaded = null;
    currentPage = 1;
    edits = [];
    mode = null;

    canvas = document.getElementById('etCanvas');
    ctx = canvas.getContext('2d');

    const dropZone = document.getElementById('etDropZone');
    const fileInput = document.getElementById('etFileInput');
    ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
    dropZone.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
    fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

    document.getElementById('etModeRect').addEventListener('click', () => setMode('rect'));
    document.getElementById('etModeText').addEventListener('click', () => setMode('text'));
    document.getElementById('etUndo').addEventListener('click', undoLast);
    document.getElementById('etPrevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('etNextPage').addEventListener('click', () => changePage(1));
    document.getElementById('etApplyBtn').addEventListener('click', apply);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('click', onClick);
  }

  function setMode(m) {
    mode = mode === m ? null : m;
    document.getElementById('etModeRect').style.borderColor = mode === 'rect' ? 'var(--text)' : '';
    document.getElementById('etModeText').style.borderColor = mode === 'text' ? 'var(--text)' : '';
    const hint = document.getElementById('etModeHint');
    if (mode === 'rect') hint.textContent = 'Drag on the page to draw a whiteout box over existing text.';
    else if (mode === 'text') hint.textContent = 'Click on the page, then type the replacement text.';
    else hint.textContent = 'Pick a tool, then click or drag on the page below.';
  }

  async function loadFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) return;
    const msg = document.getElementById('etMsg');
    msg.className = 'msg';
    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
      loaded = { file, bytes, pdfDoc, pageCount: pdfDoc.numPages };
      currentPage = 1;
      edits = [];
      document.getElementById('etEditorCard').style.display = '';
      await renderPage();
      renderEditList();
    } catch (err) {
      msg.textContent = 'Could not read this PDF — it may be corrupted or password-protected.';
      msg.className = 'msg show error';
    }
  }

  async function renderPage() {
    const page = await loaded.pdfDoc.getPage(currentPage);
    const vp1 = page.getViewport({ scale: 1 });
    pageWidthPts = vp1.width;
    pageHeightPts = vp1.height;
    scale = RENDER_WIDTH / vp1.width;
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    document.getElementById('etPageLabel').textContent = `Page ${currentPage} / ${loaded.pageCount}`;
    drawOverlay();
  }

  function drawOverlay(previewRect) {
    ctx.putImageData(baseImageData, 0, 0);
    edits.filter(e => e.page === currentPage).forEach(drawEdit);
    if (previewRect) {
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#378ADD';
      ctx.strokeRect(previewRect.x, previewRect.y, previewRect.w, previewRect.h);
      ctx.setLineDash([]);
    }
  }

  function drawEdit(e) {
    if (e.type === 'rect') {
      const cx = e.xPts * scale;
      const cyTop = (pageHeightPts - e.yPts - e.hPts) * scale;
      const cw = e.wPts * scale;
      const ch = e.hPts * scale;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx, cyTop, cw, ch);
      ctx.strokeStyle = 'rgba(220,60,60,0.6)';
      ctx.strokeRect(cx, cyTop, cw, ch);
    } else {
      const cx = e.xPts * scale;
      const cy = (pageHeightPts - e.yPts) * scale;
      ctx.fillStyle = '#000000';
      ctx.font = `${e.size * scale}px sans-serif`;
      ctx.fillText(e.text, cx, cy);
    }
  }

  function onMouseDown(ev) {
    if (mode !== 'rect') return;
    const rect = canvas.getBoundingClientRect();
    dragStart = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
  function onMouseMove(ev) {
    if (mode !== 'rect' || !dragStart) return;
    const rect = canvas.getBoundingClientRect();
    const cur = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    drawOverlay({
      x: Math.min(dragStart.x, cur.x), y: Math.min(dragStart.y, cur.y),
      w: Math.abs(cur.x - dragStart.x), h: Math.abs(cur.y - dragStart.y),
    });
  }
  function onMouseUp(ev) {
    if (mode !== 'rect' || !dragStart) return;
    const rect = canvas.getBoundingClientRect();
    const cur = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    const x1 = Math.min(dragStart.x, cur.x), y1 = Math.min(dragStart.y, cur.y);
    const x2 = Math.max(dragStart.x, cur.x), y2 = Math.max(dragStart.y, cur.y);
    dragStart = null;
    if (x2 - x1 < 4 || y2 - y1 < 4) { drawOverlay(); return; }
    edits.push({
      page: currentPage, type: 'rect',
      xPts: x1 / scale,
      yPts: pageHeightPts - (y2 / scale),
      wPts: (x2 - x1) / scale,
      hPts: (y2 - y1) / scale,
    });
    renderEditList();
    drawOverlay();
  }
  function onClick(ev) {
    if (mode !== 'text') return;
    const rect = canvas.getBoundingClientRect();
    const cx = ev.clientX - rect.left, cy = ev.clientY - rect.top;
    const text = prompt('Enter replacement text:');
    if (!text) return;
    edits.push({
      page: currentPage, type: 'text',
      xPts: cx / scale, yPts: pageHeightPts - (cy / scale),
      text, size: 12,
    });
    renderEditList();
    drawOverlay();
  }

  function changePage(delta) {
    if (!loaded) return;
    const next = currentPage + delta;
    if (next < 1 || next > loaded.pageCount) return;
    currentPage = next;
    renderPage();
  }

  function undoLast() {
    for (let i = edits.length - 1; i >= 0; i--) {
      if (edits[i].page === currentPage) { edits.splice(i, 1); break; }
    }
    renderEditList();
    drawOverlay();
  }

  function renderEditList() {
    const listEl = document.getElementById('etEditList');
    if (!edits.length) { listEl.innerHTML = ''; return; }
    listEl.innerHTML = `<div class="section-label">${edits.length} edit${edits.length > 1 ? 's' : ''} across ${loaded.pageCount} page${loaded.pageCount > 1 ? 's' : ''}</div>`;
    edits.forEach((e, idx) => {
      const chip = document.createElement('span');
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:12px;background:var(--surface2);border:0.5px solid var(--border);border-radius:8px;padding:4px 8px;margin:3px 6px 0 0;';
      chip.innerHTML = e.type === 'rect'
        ? `p${e.page}: whiteout box <button style="border:none;background:none;cursor:pointer;color:var(--text-hint);" data-idx="${idx}">&times;</button>`
        : `p${e.page}: "${e.text.length > 18 ? e.text.slice(0, 18) + '\u2026' : e.text}" <button style="border:none;background:none;cursor:pointer;color:var(--text-hint);" data-idx="${idx}">&times;</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        edits.splice(idx, 1);
        renderEditList();
        drawOverlay();
      });
      listEl.appendChild(chip);
    });
  }

  async function apply() {
    if (!loaded || !edits.length) {
      const m = document.getElementById('etApplyMsg');
      m.textContent = 'No edits to apply yet.';
      m.className = 'msg show error';
      return;
    }
    const btn = document.getElementById('etApplyBtn');
    btn.disabled = true;
    btn.textContent = 'Applying\u2026';
    try {
      const doc = await PDFLib.PDFDocument.load(loaded.bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      const pages = doc.getPages();
      edits.forEach(e => {
        const page = pages[e.page - 1];
        if (!page) return;
        if (e.type === 'rect') {
          page.drawRectangle({ x: e.xPts, y: e.yPts, width: e.wPts, height: e.hPts, color: PDFLib.rgb(1, 1, 1) });
        } else {
          page.drawText(e.text, { x: e.xPts, y: e.yPts, size: e.size, font, color: PDFLib.rgb(0, 0, 0) });
        }
      });
      const bytes = await doc.save();
      const baseName = loaded.file.name.replace(/\.pdf$/i, '');
      peDownloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName}_edited.pdf`);
      const m = document.getElementById('etApplyMsg');
      m.textContent = 'Downloaded.';
      m.className = 'msg show info';
    } catch (err) {
      const m = document.getElementById('etApplyMsg');
      m.textContent = `Failed: ${err.message}`;
      m.className = 'msg show error';
    } finally {
      btn.disabled = false;
      btn.textContent = '\u2193 Apply and download';
    }
  }

  return { init };
})();

// ═══════════════════════════════════════════════════════════════
// OCR — extract text from scanned PDFs or images (Tesseract.js)
// ═══════════════════════════════════════════════════════════════
window.PdfOcr = (() => {
  let items = []; // { id, file }
  let seq = 0;

  function init(mountId) {
    const el = document.getElementById(mountId);
    if (!el) return;
    el.innerHTML = `
      <div class="card" id="ocrUploadCard">
        <div class="section-label">OCR &mdash; extract text</div>
        <p class="card-hint">Works on scanned PDFs and images. Runs entirely in your browser &mdash; large files can take a while.</p>
        <div class="upload-zone" id="ocrDropZone">
          <input type="file" id="ocrFileInput" accept=".pdf,image/png,image/jpeg,image/webp" multiple />
          <div class="upload-zone-text">
            <strong>Drop PDFs or images here or click to browse</strong>
            Multiple files allowed
          </div>
        </div>
        <div id="ocrFileList"></div>
        <div class="msg" id="ocrMsg"></div>
      </div>

      <div class="card action-card" id="ocrActionsCard" style="display:none;">
        <button class="btn-primary" id="ocrRunBtn">Run OCR</button>
        <span class="generate-hint" id="ocrProgress"></span>
      </div>

      <div class="card" id="ocrResultCard" style="display:none;">
        <div class="section-label">Extracted text</div>
        <textarea id="ocrResultText" readonly style="width:100%;min-height:220px;background:var(--surface2);border:0.5px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-family:var(--font-mono);font-size:13px;"></textarea>
        <div class="btn-row" style="display:flex;gap:10px;margin-top:10px;">
          <button class="btn-secondary" id="ocrCopyBtn">Copy</button>
          <button class="btn-secondary" id="ocrDownloadBtn">Download .txt</button>
        </div>
      </div>
    `;

    items = [];
    seq = 0;

    const dropZone = document.getElementById('ocrDropZone');
    const fileInput = document.getElementById('ocrFileInput');
    ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
    dropZone.addEventListener('drop', e => addFiles(e.dataTransfer.files));
    fileInput.addEventListener('change', () => addFiles(fileInput.files));
    document.getElementById('ocrRunBtn').addEventListener('click', runOcr);
    document.getElementById('ocrCopyBtn').addEventListener('click', copyResult);
    document.getElementById('ocrDownloadBtn').addEventListener('click', downloadResult);
  }

  function addFiles(fileList) {
    const valid = [...fileList].filter(f =>
      f.name.toLowerCase().endsWith('.pdf') || /^image\/(png|jpeg|webp)$/.test(f.type)
    );
    valid.forEach(file => items.push({ id: ++seq, file }));
    renderList();
  }

  function renderList() {
    const listEl = document.getElementById('ocrFileList');
    const actions = document.getElementById('ocrActionsCard');
    if (!items.length) { listEl.innerHTML = ''; actions.style.display = 'none'; return; }
    listEl.innerHTML = `<div class="section-label" style="margin-top:1rem;">${items.length} file${items.length > 1 ? 's' : ''}</div><div id="ocrRows"></div>`;
    const rows = document.getElementById('ocrRows');
    items.forEach(it => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:0.5px solid var(--border);';
      row.innerHTML = `
        <div style="flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${it.file.name}</div>
        <span style="font-size:12px;color:var(--text-hint);">${peFmtBytes(it.file.size)}</span>
        <button class="btn-secondary" data-id="${it.id}">&times;</button>
      `;
      rows.appendChild(row);
    });
    rows.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        items = items.filter(i => i.id !== Number(btn.dataset.id));
        renderList();
      });
    });
    actions.style.display = '';
  }

  async function runOcr() {
    if (!items.length || !window.Tesseract) return;
    const btn = document.getElementById('ocrRunBtn');
    const progress = document.getElementById('ocrProgress');
    btn.disabled = true;
    let combined = '';
    try {
      for (let f = 0; f < items.length; f++) {
        const item = items[f];
        progress.textContent = `File ${f + 1} of ${items.length}: ${item.file.name}`;
        if (item.file.name.toLowerCase().endsWith('.pdf')) {
          const bytes = await item.file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
          for (let p = 1; p <= pdf.numPages; p++) {
            progress.textContent = `File ${f + 1} of ${items.length}: ${item.file.name} \u2014 page ${p} of ${pdf.numPages}`;
            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            const { data } = await Tesseract.recognize(canvas, 'eng');
            combined += `\n\n===== ${item.file.name} \u2014 page ${p} =====\n${data.text.trim()}`;
          }
        } else {
          const { data } = await Tesseract.recognize(item.file, 'eng');
          combined += `\n\n===== ${item.file.name} =====\n${data.text.trim()}`;
        }
      }
      document.getElementById('ocrResultText').value = combined.trim();
      document.getElementById('ocrResultCard').style.display = '';
      progress.textContent = 'Done.';
    } catch (err) {
      progress.textContent = `Failed: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  }

  function copyResult() {
    const ta = document.getElementById('ocrResultText');
    ta.select();
    document.execCommand('copy');
  }

  function downloadResult() {
    const text = document.getElementById('ocrResultText').value;
    peDownloadBlob(new Blob([text], { type: 'text/plain' }), 'ocr-result.txt');
  }

  return { init };
})();
