// ─────────────────────────────────────────────────────────────────
// PDF EDITOR TOOLS — pdf-editor-tools.js
// Phase 1: Merge/Split/Rotate/Reorder, Watermark/Page numbers, Image<->PDF
// Depends on: pdf-lib (PDFLib), pdf.js (pdfjsLib), JSZip
// ─────────────────────────────────────────────────────────────────

function peFmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function peDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ═══════════════════════════════════════════════════════════════
// MERGE / SPLIT / ROTATE / REORDER
// ═══════════════════════════════════════════════════════════════
window.PdfMerge = (() => {
  let files = []; // { id, file, bytes, pageCount, rotation }
  let seq = 0;
  let dropZone, fileInput, msgEl, listEl, actionsCard, mergeBtn, mergeHint;

  function init(mountId) {
    const el = document.getElementById(mountId);
    if (!el) return;
    el.innerHTML = `
      <div class="card" id="pmUploadCard">
        <div class="section-label">Merge / Split / Rotate / Reorder</div>
        <div class="upload-zone" id="pmDropZone">
          <input type="file" id="pmFileInput" accept=".pdf" multiple />
          <div class="upload-zone-text">
            <strong>Drop PDF files here or click to browse</strong>
            You can select multiple files &middot; drag to reorder with the arrows below
          </div>
        </div>
        <div class="msg" id="pmMsg"></div>
      </div>
      <div id="pmList"></div>
      <div class="card action-card" id="pmActionsCard" style="display:none;">
        <button class="btn-primary" id="pmMergeBtn">&#8595; Merge into one PDF</button>
        <span class="generate-hint" id="pmMergeHint"></span>
      </div>
    `;

    dropZone = document.getElementById('pmDropZone');
    fileInput = document.getElementById('pmFileInput');
    msgEl = document.getElementById('pmMsg');
    listEl = document.getElementById('pmList');
    actionsCard = document.getElementById('pmActionsCard');
    mergeBtn = document.getElementById('pmMergeBtn');
    mergeHint = document.getElementById('pmMergeHint');

    files = [];
    seq = 0;

    ['dragenter', 'dragover'].forEach(evt => {
      dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('dragover'); });
    });
    dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    mergeBtn.addEventListener('click', doMerge);
  }

  async function handleFiles(fileList) {
    const pdfs = [...fileList].filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) {
      showMsg('No PDF files found in selection.', 'error');
      return;
    }
    showMsg('', '');
    for (const file of pdfs) {
      try {
        const bytes = await file.arrayBuffer();
        const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        files.push({ id: ++seq, file, bytes, pageCount: doc.getPageCount(), rotation: 0 });
      } catch (err) {
        showMsg(`Could not read "${file.name}" — it may be corrupted or password-protected.`, 'error');
      }
    }
    fileInput.value = '';
    render();
  }

  function showMsg(text, type) {
    msgEl.textContent = text;
    msgEl.className = 'msg' + (text ? ` show ${type || 'error'}` : '');
  }

  function render() {
    if (!files.length) {
      listEl.innerHTML = '';
      actionsCard.style.display = 'none';
      return;
    }
    listEl.innerHTML = `
      <div class="card">
        <div class="section-label">${files.length} file${files.length > 1 ? 's' : ''} loaded</div>
        <div id="pmRows"></div>
      </div>
    `;
    const rows = document.getElementById('pmRows');
    files.forEach((f, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border);';
      row.innerHTML = `
        <span style="font-size:13px;color:var(--text-hint);min-width:18px;">${idx + 1}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.file.name}</div>
          <div style="font-size:12px;color:var(--text-hint);">${f.pageCount} page${f.pageCount > 1 ? 's' : ''} &middot; ${peFmtBytes(f.file.size)}${f.rotation ? ' &middot; rotated ' + f.rotation + '&deg;' : ''}</div>
        </div>
        <button class="btn-secondary" data-act="up" data-id="${f.id}" title="Move up">&#8593;</button>
        <button class="btn-secondary" data-act="down" data-id="${f.id}" title="Move down">&#8595;</button>
        <button class="btn-secondary" data-act="rotate" data-id="${f.id}" title="Rotate 90&deg;">&#8635;</button>
        <button class="btn-secondary" data-act="split" data-id="${f.id}" title="Split into pages">Split</button>
        <button class="btn-secondary" data-act="remove" data-id="${f.id}" title="Remove">&times;</button>
      `;
      rows.appendChild(row);
    });
    rows.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => onRowAction(btn.dataset.act, Number(btn.dataset.id)));
    });
    actionsCard.style.display = '';
    mergeHint.textContent = files.length === 1
      ? '1 file loaded — merge will just re-save it (useful after rotating).'
      : `Will combine ${files.length} files in the order shown above.`;
  }

  function onRowAction(act, id) {
    const idx = files.findIndex(f => f.id === id);
    if (idx === -1) return;
    if (act === 'up' && idx > 0) [files[idx - 1], files[idx]] = [files[idx], files[idx - 1]];
    if (act === 'down' && idx < files.length - 1) [files[idx + 1], files[idx]] = [files[idx], files[idx + 1]];
    if (act === 'rotate') files[idx].rotation = (files[idx].rotation + 90) % 360;
    if (act === 'remove') files.splice(idx, 1);
    if (act === 'split') doSplit(files[idx]);
    render();
  }

  async function doSplit(entry) {
    try {
      const srcDoc = await PDFLib.PDFDocument.load(entry.bytes, { ignoreEncryption: true });
      const count = srcDoc.getPageCount();
      const baseName = entry.file.name.replace(/\.pdf$/i, '');

      if (count === 1) {
        const bytes = await srcDoc.save();
        peDownloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName}.pdf`);
        return;
      }

      const zip = new JSZip();
      for (let i = 0; i < count; i++) {
        const outDoc = await PDFLib.PDFDocument.create();
        const [page] = await outDoc.copyPages(srcDoc, [i]);
        if (entry.rotation) page.setRotation(PDFLib.degrees(entry.rotation));
        outDoc.addPage(page);
        const bytes = await outDoc.save();
        zip.file(`${baseName}_page${String(i + 1).padStart(2, '0')}.pdf`, bytes);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      peDownloadBlob(blob, `${baseName}_split.zip`);
    } catch (err) {
      showMsg(`Split failed: ${err.message}`, 'error');
    }
  }

  async function doMerge() {
    if (!files.length) return;
    mergeBtn.disabled = true;
    mergeBtn.textContent = 'Merging\u2026';
    try {
      const outDoc = await PDFLib.PDFDocument.create();
      for (const entry of files) {
        const srcDoc = await PDFLib.PDFDocument.load(entry.bytes, { ignoreEncryption: true });
        const pages = await outDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        pages.forEach(page => {
          if (entry.rotation) page.setRotation(PDFLib.degrees((page.getRotation().angle + entry.rotation) % 360));
          outDoc.addPage(page);
        });
      }
      const bytes = await outDoc.save();
      peDownloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf');
      showMsg('Merged PDF downloaded.', 'info');
    } catch (err) {
      showMsg(`Merge failed: ${err.message}`, 'error');
    } finally {
      mergeBtn.disabled = false;
      mergeBtn.textContent = '\u2193 Merge into one PDF';
    }
  }

  return { init };
})();

// ═══════════════════════════════════════════════════════════════
// WATERMARK / PAGE NUMBERS
// ═══════════════════════════════════════════════════════════════
window.PdfWatermark = (() => {
  let loaded = null; // { file, bytes, pageCount }

  function init(mountId) {
    const el = document.getElementById(mountId);
    if (!el) return;
    el.innerHTML = `
      <div class="card" id="wmUploadCard">
        <div class="section-label">Watermark / Page numbers</div>
        <div class="upload-zone" id="wmDropZone">
          <input type="file" id="wmFileInput" accept=".pdf" />
          <div class="upload-zone-text">
            <strong>Drop a PDF here or click to browse</strong>
            One file at a time
          </div>
        </div>
        <div class="file-loaded" id="wmFileLoaded">
          <span>&#10003;</span>
          <div>
            <div class="file-loaded-name" id="wmLoadedName">&mdash;</div>
            <div class="file-loaded-meta" id="wmLoadedMeta">&mdash;</div>
          </div>
        </div>
        <div class="msg" id="wmMsg"></div>
      </div>

      <div class="card" id="wmOptionsCard" style="display:none;">
        <div class="section-label">Watermark text <span class="optional-label">optional</span></div>
        <input type="text" id="wmText" placeholder="e.g. DRAFT, CONFIDENTIAL" style="width:100%;height:42px;padding:0 12px;background:var(--surface2);border:0.5px solid var(--border-strong);border-radius:8px;color:var(--text);font-size:14px;margin-bottom:10px;" />
        <div class="selector-row">
          <div class="selector-group">
            <label>Opacity</label>
            <select id="wmOpacity">
              <option value="0.1">10%</option>
              <option value="0.15" selected>15%</option>
              <option value="0.25">25%</option>
              <option value="0.4">40%</option>
            </select>
          </div>
          <div class="selector-group">
            <label>Font size</label>
            <select id="wmSize">
              <option value="40">Small</option>
              <option value="60" selected>Medium</option>
              <option value="90">Large</option>
            </select>
          </div>
        </div>

        <div class="section-label" style="margin-top:1rem;">Page numbers <span class="optional-label">optional</span></div>
        <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">
          <input type="checkbox" id="wmPageNumbers" style="width:16px;height:16px;" />
          Add page numbers to bottom of each page
        </label>
      </div>

      <div class="card action-card" id="wmActionsCard" style="display:none;">
        <button class="btn-primary" id="wmApplyBtn">&#8595; Apply and download</button>
        <div class="msg" id="wmApplyMsg"></div>
      </div>
    `;

    const dropZone = document.getElementById('wmDropZone');
    const fileInput = document.getElementById('wmFileInput');

    ['dragenter', 'dragover'].forEach(evt => {
      dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('dragover'); });
    });
    dropZone.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));
    fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
    document.getElementById('wmApplyBtn').addEventListener('click', apply);
  }

  async function handleFile(file) {
    if (!file) return;
    const msg = document.getElementById('wmMsg');
    msg.className = 'msg';
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      msg.textContent = 'Please select a PDF file.';
      msg.className = 'msg show error';
      return;
    }
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      loaded = { file, bytes, pageCount: doc.getPageCount() };
      document.getElementById('wmFileLoaded').classList.add('show');
      document.getElementById('wmLoadedName').textContent = file.name;
      document.getElementById('wmLoadedMeta').textContent = `${loaded.pageCount} page${loaded.pageCount > 1 ? 's' : ''} \u00b7 ${peFmtBytes(file.size)}`;
      document.getElementById('wmOptionsCard').style.display = '';
      document.getElementById('wmActionsCard').style.display = '';
    } catch (err) {
      msg.textContent = 'Could not read this PDF — it may be corrupted or password-protected.';
      msg.className = 'msg show error';
    }
  }

  async function apply() {
    if (!loaded) return;
    const text = document.getElementById('wmText').value.trim();
    const addNumbers = document.getElementById('wmPageNumbers').checked;
    if (!text && !addNumbers) {
      const m = document.getElementById('wmApplyMsg');
      m.textContent = 'Enter watermark text or enable page numbers first.';
      m.className = 'msg show error';
      return;
    }
    const btn = document.getElementById('wmApplyBtn');
    btn.disabled = true;
    btn.textContent = 'Applying\u2026';
    try {
      const opacity = parseFloat(document.getElementById('wmOpacity').value);
      const size = parseFloat(document.getElementById('wmSize').value);
      const doc = await PDFLib.PDFDocument.load(loaded.bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      const numFont = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      const pages = doc.getPages();

      pages.forEach((page, i) => {
        const { width, height } = page.getSize();
        if (text) {
          const textWidth = font.widthOfTextAtSize(text, size);
          page.drawText(text, {
            x: width / 2 - textWidth / 2,
            y: height / 2,
            size,
            font,
            color: PDFLib.rgb(0.5, 0.5, 0.5),
            opacity,
            rotate: PDFLib.degrees(45),
          });
        }
        if (addNumbers) {
          const label = `${i + 1} / ${pages.length}`;
          const labelWidth = numFont.widthOfTextAtSize(label, 10);
          page.drawText(label, {
            x: width / 2 - labelWidth / 2,
            y: 24,
            size: 10,
            font: numFont,
            color: PDFLib.rgb(0.4, 0.4, 0.4),
          });
        }
      });

      const bytes = await doc.save();
      const baseName = loaded.file.name.replace(/\.pdf$/i, '');
      peDownloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName}_edited.pdf`);
      const m = document.getElementById('wmApplyMsg');
      m.textContent = 'Downloaded.';
      m.className = 'msg show info';
    } catch (err) {
      const m = document.getElementById('wmApplyMsg');
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
// IMAGE <-> PDF
// ═══════════════════════════════════════════════════════════════
window.PdfImages = (() => {
  let images = []; // { id, file }
  let pdfLoaded = null; // { file, bytes }
  let seq = 0;

  function init(mountId) {
    const el = document.getElementById(mountId);
    if (!el) return;
    el.innerHTML = `
      <div class="mode-tabs" id="piSubTabs" style="margin-bottom:1rem;">
        <button class="mode-tab active" data-sub="toPdf">Images &#8594; PDF</button>
        <button class="mode-tab" data-sub="toImg">PDF &#8594; Images</button>
      </div>

      <div id="piToPdf">
        <div class="card">
          <div class="section-label">Images to combine</div>
          <div class="upload-zone" id="piImgDropZone">
            <input type="file" id="piImgFileInput" accept="image/png,image/jpeg,image/webp" multiple />
            <div class="upload-zone-text">
              <strong>Drop images here or click to browse</strong>
              JPG, PNG, WEBP &middot; multiple allowed, one per page
            </div>
          </div>
          <div id="piImgList"></div>
        </div>
        <div class="card action-card" id="piToPdfActions" style="display:none;">
          <button class="btn-primary" id="piToPdfBtn">&#8595; Create PDF</button>
          <div class="msg" id="piToPdfMsg"></div>
        </div>
      </div>

      <div id="piToImg" style="display:none;">
        <div class="card">
          <div class="section-label">PDF to export as images</div>
          <div class="upload-zone" id="piPdfDropZone">
            <input type="file" id="piPdfFileInput" accept=".pdf" />
            <div class="upload-zone-text">
              <strong>Drop a PDF here or click to browse</strong>
              Each page exported as a PNG
            </div>
          </div>
          <div class="file-loaded" id="piPdfFileLoaded">
            <span>&#10003;</span>
            <div>
              <div class="file-loaded-name" id="piPdfLoadedName">&mdash;</div>
              <div class="file-loaded-meta" id="piPdfLoadedMeta">&mdash;</div>
            </div>
          </div>
        </div>
        <div class="card action-card" id="piToImgActions" style="display:none;">
          <button class="btn-primary" id="piToImgBtn">&#8595; Export as PNG</button>
          <div class="msg" id="piToImgMsg"></div>
        </div>
      </div>
    `;

    images = [];
    seq = 0;
    pdfLoaded = null;

    document.querySelectorAll('#piSubTabs .mode-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#piSubTabs .mode-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('piToPdf').style.display = btn.dataset.sub === 'toPdf' ? '' : 'none';
        document.getElementById('piToImg').style.display = btn.dataset.sub === 'toImg' ? '' : 'none';
      });
    });

    const imgDropZone = document.getElementById('piImgDropZone');
    const imgFileInput = document.getElementById('piImgFileInput');
    ['dragenter', 'dragover'].forEach(evt => imgDropZone.addEventListener(evt, e => { e.preventDefault(); imgDropZone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(evt => imgDropZone.addEventListener(evt, e => { e.preventDefault(); imgDropZone.classList.remove('dragover'); }));
    imgDropZone.addEventListener('drop', e => addImages(e.dataTransfer.files));
    imgFileInput.addEventListener('change', () => addImages(imgFileInput.files));
    document.getElementById('piToPdfBtn').addEventListener('click', imagesToPdf);

    const pdfDropZone = document.getElementById('piPdfDropZone');
    const pdfFileInput = document.getElementById('piPdfFileInput');
    ['dragenter', 'dragover'].forEach(evt => pdfDropZone.addEventListener(evt, e => { e.preventDefault(); pdfDropZone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(evt => pdfDropZone.addEventListener(evt, e => { e.preventDefault(); pdfDropZone.classList.remove('dragover'); }));
    pdfDropZone.addEventListener('drop', e => loadPdfForExport(e.dataTransfer.files[0]));
    pdfFileInput.addEventListener('change', () => loadPdfForExport(pdfFileInput.files[0]));
    document.getElementById('piToImgBtn').addEventListener('click', pdfToImages);
  }

  function addImages(fileList) {
    const imgs = [...fileList].filter(f => /^image\/(png|jpeg|webp)$/.test(f.type));
    imgs.forEach(file => images.push({ id: ++seq, file }));
    renderImgList();
  }

  function renderImgList() {
    const listEl = document.getElementById('piImgList');
    const actions = document.getElementById('piToPdfActions');
    if (!images.length) {
      listEl.innerHTML = '';
      actions.style.display = 'none';
      return;
    }
    listEl.innerHTML = `<div class="section-label" style="margin-top:1rem;">${images.length} image${images.length > 1 ? 's' : ''} &middot; in page order</div><div id="piImgRows"></div>`;
    const rows = document.getElementById('piImgRows');
    images.forEach((img, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:0.5px solid var(--border);';
      row.innerHTML = `
        <span style="font-size:13px;color:var(--text-hint);min-width:18px;">${idx + 1}</span>
        <div style="flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${img.file.name}</div>
        <button class="btn-secondary" data-act="up" data-id="${img.id}">&#8593;</button>
        <button class="btn-secondary" data-act="down" data-id="${img.id}">&#8595;</button>
        <button class="btn-secondary" data-act="remove" data-id="${img.id}">&times;</button>
      `;
      rows.appendChild(row);
    });
    rows.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const idx = images.findIndex(i => i.id === id);
        if (idx === -1) return;
        if (btn.dataset.act === 'up' && idx > 0) [images[idx - 1], images[idx]] = [images[idx], images[idx - 1]];
        if (btn.dataset.act === 'down' && idx < images.length - 1) [images[idx + 1], images[idx]] = [images[idx], images[idx + 1]];
        if (btn.dataset.act === 'remove') images.splice(idx, 1);
        renderImgList();
      });
    });
    actions.style.display = '';
  }

  async function imagesToPdf() {
    if (!images.length) return;
    const btn = document.getElementById('piToPdfBtn');
    btn.disabled = true;
    btn.textContent = 'Creating\u2026';
    try {
      const doc = await PDFLib.PDFDocument.create();
      for (const img of images) {
        const bytes = await img.file.arrayBuffer();
        const isPng = img.file.type === 'image/png';
        const embedded = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const page = doc.addPage([embedded.width, embedded.height]);
        page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
      }
      const bytes = await doc.save();
      peDownloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'images.pdf');
      const m = document.getElementById('piToPdfMsg');
      m.textContent = 'Downloaded.';
      m.className = 'msg show info';
    } catch (err) {
      const m = document.getElementById('piToPdfMsg');
      m.textContent = `Failed: ${err.message}. Note: WEBP images are not supported by the PDF library — use JPG or PNG.`;
      m.className = 'msg show error';
    } finally {
      btn.disabled = false;
      btn.textContent = '\u2193 Create PDF';
    }
  }

  async function loadPdfForExport(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) return;
    const bytes = await file.arrayBuffer();
    pdfLoaded = { file, bytes };
    document.getElementById('piPdfFileLoaded').classList.add('show');
    document.getElementById('piPdfLoadedName').textContent = file.name;
    document.getElementById('piPdfLoadedMeta').textContent = peFmtBytes(file.size);
    document.getElementById('piToImgActions').style.display = '';
  }

  async function pdfToImages() {
    if (!pdfLoaded) return;
    const btn = document.getElementById('piToImgBtn');
    btn.disabled = true;
    btn.textContent = 'Exporting\u2026';
    try {
      const loadingTask = pdfjsLib.getDocument({ data: pdfLoaded.bytes.slice(0) });
      const pdf = await loadingTask.promise;
      const baseName = pdfLoaded.file.name.replace(/\.pdf$/i, '');
      const pngBlobs = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        pngBlobs.push({ name: `${baseName}_page${String(i).padStart(2, '0')}.png`, blob });
      }

      if (pngBlobs.length === 1) {
        peDownloadBlob(pngBlobs[0].blob, pngBlobs[0].name);
      } else {
        const zip = new JSZip();
        pngBlobs.forEach(p => zip.file(p.name, p.blob));
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        peDownloadBlob(zipBlob, `${baseName}_pages.zip`);
      }
      const m = document.getElementById('piToImgMsg');
      m.textContent = 'Downloaded.';
      m.className = 'msg show info';
    } catch (err) {
      const m = document.getElementById('piToImgMsg');
      m.textContent = `Failed: ${err.message}`;
      m.className = 'msg show error';
    } finally {
      btn.disabled = false;
      btn.textContent = '\u2193 Export as PNG';
    }
  }

  return { init };
})();
