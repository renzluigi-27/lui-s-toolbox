// ─────────────────────────────────────────────────────────────────
// EML TO PDF — eml-to-pdf.js
// Parses .eml files client-side and renders each as an LMC-letterheaded
// PDF. Content is rasterized per-page (html2canvas) and composited onto
// the real letterhead PDF (assets/lmc_letterhead.pdf) via pdf-lib, the
// same approach used by payout-schedule.js.
// Depends on: html2canvas, pdf-lib (PDFLib), JSZip
// ─────────────────────────────────────────────────────────────────

window.EmlToPdf = (() => {

  const LETTERHEAD_URL = '/assets/lmc_letterhead.pdf';

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  let items = []; // { id, file, fromName, fromEmail, toText, dateText, subject, bodyHtml, clientName, autoDetected }
  let seq = 0;

  // DOM refs (set on init)
  let dropZone, fileInput, uploadMsg, actionsCard, itemCountLabel, emailList, downloadAllBtn, clearAllBtn, progressHint;

  // ═══════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════
  function init(mountId) {
    injectPdfContentStyles();

    const el = document.getElementById(mountId);
    if (!el) return;
    el.innerHTML = `
      <div class="card" id="etpUploadCard">
        <div class="section-label">Upload .eml files</div>
        <div class="upload-zone" id="etpDropZone">
          <input type="file" id="etpFileInput" accept=".eml" multiple />
          <div class="upload-zone-text">
            <strong>Drop .eml files here or click to browse</strong>
            You can select multiple files at once
          </div>
        </div>
        <div class="msg" id="etpUploadMsg"></div>
      </div>

      <div class="card action-card" id="etpActionsCard" style="display:none;">
        <div class="section-label" id="etpItemCountLabel">0 emails loaded</div>
        <button class="btn-primary" id="etpDownloadAllBtn">&#8595; Download All (ZIP)</button>
        <span class="generate-hint" id="etpProgressHint"></span>
      </div>

      <div id="etpEmailList"></div>
    `;

    dropZone = document.getElementById('etpDropZone');
    fileInput = document.getElementById('etpFileInput');
    uploadMsg = document.getElementById('etpUploadMsg');
    actionsCard = document.getElementById('etpActionsCard');
    itemCountLabel = document.getElementById('etpItemCountLabel');
    emailList = document.getElementById('etpEmailList');
    downloadAllBtn = document.getElementById('etpDownloadAllBtn');
    progressHint = document.getElementById('etpProgressHint');

    items = [];
    seq = 0;

    ['dragenter', 'dragover'].forEach(evt => {
      dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('dragover'); });
    });
    dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
    fileInput.addEventListener('change', e => { handleFiles(e.target.files); fileInput.value = ''; });

    downloadAllBtn.addEventListener('click', downloadAll);

    renderList();
  }

  // A tiny stylesheet, injected once, for the hidden offscreen stage used
  // to rasterize each email into the PDF. These classes never appear in
  // the visible page UI (which uses the site's shared CSS) — they only
  // shape the html2canvas snapshot that becomes the PDF content.
  function injectPdfContentStyles() {
    if (document.getElementById('etp-pdf-content-styles')) return;
    const style = document.createElement('style');
    style.id = 'etp-pdf-content-styles';
    style.textContent = `
      .eh-toprow { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 4px; }
      .eh-sender { display: flex; align-items: center; gap: 12px; }
      .eh-avatar { width: 40px; height: 40px; border-radius: 50%; background: #dfe1e6; color: #55585e; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 16px; flex-shrink: 0; }
      .eh-sender-name { font-size: 14px; font-weight: 600; color: #16171a; }
      .eh-sender-email { font-size: 12px; color: #6b6e76; }
      .eh-date { font-size: 12px; color: #6b6e76; white-space: nowrap; padding-top: 4px; }
      .eh-torow { font-size: 12px; color: #6b6e76; margin: 8px 0 14px 52px; }
      .eh-subject { font-size: 16px; font-weight: 600; color: #16171a; margin-bottom: 14px; }
      .eh-divider { border: none; border-top: 1px solid #d9dbe0; margin-bottom: 18px; }
      .eh-body { font-size: 13px; line-height: 1.45; color: #1a1a18; word-wrap: break-word; }
      .eh-body img { max-width: 100%; }
      .eh-body a { color: #2764c7; }
      .eh-body p { margin: 0 0 8px 0; }
      .eh-body div { margin: 0; }
      .eh-body ul, .eh-body ol { margin: 2px 0 8px; padding-left: 20px; }
      .eh-body table { border-collapse: collapse; }
      .etp-name-field-wrap { margin-bottom: 10px; }
      .etp-name-field-wrap label { display: block; font-size: 11px; color: var(--text-hint); margin-bottom: 4px; }
      .etp-name-field-wrap input { width: 100%; padding: 8px 10px; font-size: 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); }
      .etp-name-field-wrap input.etp-auto-flagged { border-color: var(--warn-dot, #E8A000); }
      .etp-name-flag-note { font-size: 11px; color: var(--warn-text); margin-top: 2px; }
      .etp-item-actions { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
      .etp-email-item-meta { font-size: 12px; color: var(--text-hint); margin-top: 2px; }
    `;
    document.head.appendChild(style);
  }

  function showMsg(text, type) {
    uploadMsg.textContent = text;
    uploadMsg.className = 'msg show ' + type;
  }
  function clearMsg() {
    uploadMsg.className = 'msg';
    uploadMsg.textContent = '';
  }

  // ═══════════════════════════════════════════════════════════════
  // FILE HANDLING
  // ═══════════════════════════════════════════════════════════════
  function handleFiles(fileList) {
    const files = Array.prototype.filter.call(fileList, f => /\.eml$/i.test(f.name));
    if (!files.length) {
      showMsg('No .eml files found in your selection.', 'error');
      return;
    }
    clearMsg();
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = parseEML(reader.result);
          addItem(file, parsed);
        } catch (err) {
          console.error('Failed to parse', file.name, err);
          showMsg('Could not parse ' + file.name + ' — skipped.', 'error');
        }
      };
      reader.onerror = () => showMsg('Could not read ' + file.name + ' — skipped.', 'error');
      reader.readAsArrayBuffer(file);
    });
  }

  function addItem(file, parsed) {
    seq++;
    items.push({
      id: 'etp-item' + seq,
      file: file,
      fromName: parsed.fromName,
      fromEmail: parsed.fromEmail,
      toText: parsed.toText,
      dateText: parsed.dateText,
      subject: parsed.subject,
      bodyHtml: parsed.bodyHtml,
      clientName: parsed.guessedName || parsed.fromName || '',
      autoDetected: !!parsed.guessedName
    });
    renderList();
  }

  function removeItem(id) {
    items = items.filter(it => it.id !== id);
    renderList();
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER LIST
  // ═══════════════════════════════════════════════════════════════
  function renderList() {
    emailList.innerHTML = '';
    actionsCard.style.display = items.length ? '' : 'none';
    itemCountLabel.textContent = items.length + (items.length === 1 ? ' email loaded' : ' emails loaded');

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';

      const nameWrap = document.createElement('div');
      nameWrap.className = 'etp-name-field-wrap';
      const label = document.createElement('label');
      label.textContent = 'Client name (PDF filename)';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = item.autoDetected ? '' : 'etp-auto-flagged';
      input.value = item.clientName;
      input.addEventListener('input', () => { item.clientName = input.value; });
      nameWrap.appendChild(label);
      nameWrap.appendChild(input);
      if (!item.autoDetected) {
        const flagNote = document.createElement('div');
        flagNote.className = 'etp-name-flag-note';
        flagNote.textContent = 'Could not auto-detect name from greeting — please check/edit.';
        nameWrap.appendChild(flagNote);
      }

      const actions = document.createElement('div');
      actions.className = 'etp-item-actions';
      const dlBtn = document.createElement('button');
      dlBtn.className = 'btn-primary';
      dlBtn.textContent = 'Download PDF';
      dlBtn.addEventListener('click', () => downloadSingle(item));
      const rmBtn = document.createElement('button');
      rmBtn.className = 'btn-secondary';
      rmBtn.textContent = 'Remove';
      rmBtn.addEventListener('click', () => removeItem(item.id));
      actions.appendChild(dlBtn);
      actions.appendChild(rmBtn);

      const meta = document.createElement('div');
      meta.className = 'etp-email-item-meta';
      meta.textContent = item.file.name;

      card.appendChild(nameWrap);
      card.appendChild(actions);
      card.appendChild(meta);

      emailList.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function sanitizeHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    div.querySelectorAll('script, style, link, meta, iframe, object, embed').forEach(n => n.remove());
    div.querySelectorAll('*').forEach(n => {
      Array.prototype.slice.call(n.attributes).forEach(a => {
        if (/^on/i.test(a.name)) n.removeAttribute(a.name);
      });
    });
    // Collapse Outlook-style blank-line spacer elements down to a small
    // fixed gap instead of a full text line.
    div.querySelectorAll('div, p').forEach(el => {
      const stripped = el.innerHTML.replace(/&nbsp;/gi, '').replace(/<br\s*\/?>/gi, '').replace(/\s+/g, '');
      if (stripped === '' && el.children.length <= 1) {
        el.style.margin = '0';
        el.style.padding = '0';
        el.style.lineHeight = '8px';
        el.style.minHeight = '8px';
        el.style.maxHeight = '8px';
        el.style.overflow = 'hidden';
      }
    });
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════
  // PDF CONTENT GEOMETRY (96dpi CSS-px stage; scaled to letterhead's pt
  // dimensions at composite time)
  // ═══════════════════════════════════════════════════════════════
  const PAGE_W_PX = 816, PAGE_H_PX = 1056;
  const LEFT_PAD_PX = 72, RIGHT_PAD_PX = 58, TOP_PAD_PX = 178, BOTTOM_PAD_PX = 130;
  const CONTENT_W_PX = PAGE_W_PX - LEFT_PAD_PX - RIGHT_PAD_PX;
  const USABLE_H_PX = PAGE_H_PX - TOP_PAD_PX - BOTTOM_PAD_PX;
  const RENDER_SCALE = 2;

  function buildHeaderEl(item) {
    const wrap = document.createElement('div');
    const initial = (item.fromName || item.fromEmail || '?').trim().charAt(0).toUpperCase();

    const topRow = document.createElement('div');
    topRow.className = 'eh-toprow';
    const sender = document.createElement('div');
    sender.className = 'eh-sender';
    sender.innerHTML =
      '<div class="eh-avatar">' + escapeHtml(initial) + '</div>' +
      '<div><div class="eh-sender-name">' + escapeHtml(item.fromName || item.fromEmail) + '</div>' +
      '<div class="eh-sender-email">' + escapeHtml(item.fromEmail) + '</div></div>';
    const dateEl = document.createElement('div');
    dateEl.className = 'eh-date';
    dateEl.textContent = item.dateText;
    topRow.appendChild(sender);
    topRow.appendChild(dateEl);

    const toRow = document.createElement('div');
    toRow.className = 'eh-torow';
    toRow.textContent = 'To ' + item.toText;

    const subjectEl = document.createElement('div');
    subjectEl.className = 'eh-subject';
    subjectEl.textContent = item.subject;

    const hr = document.createElement('hr');
    hr.className = 'eh-divider';

    wrap.appendChild(topRow);
    wrap.appendChild(toRow);
    wrap.appendChild(subjectEl);
    wrap.appendChild(hr);
    return wrap;
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGE-BOUNDARY DETECTION (each historical message starts fresh page)
  // ═══════════════════════════════════════════════════════════════
  const BOUNDARY_TEXT_PATTERNS = [
    /^On\b.{0,160}wrote:?\s*$/i,
    /^From:\s/i,
    /^من:\s/,
    /بداية الرسالة المحولة/,
    /^-{2,}\s*Original Message\s*-{2,}$/i,
    /^-{2,}\s*Forwarded message\s*-{2,}$/i
  ];

  function isBoundaryText(text) {
    const t = (text || '').trim();
    if (!t) return false;
    return BOUNDARY_TEXT_PATTERNS.some(re => re.test(t));
  }

  // Narrower check used only for the node right after an <hr>: a plain
  // signature divider (e.g. before "Kind Regards,") should NOT force a
  // page break, but an <hr> that precedes a quoted-reply header block
  // (From:/Sent:/To:/Cc:/Date:/Subject: or "On ... wrote:") still should.
  const QUOTED_HEADER_AFTER_HR_PATTERNS = BOUNDARY_TEXT_PATTERNS.concat([
    /^Sent:\s/i,
    /^To:\s/i,
    /^Cc:\s/i,
    /^Date:\s/i,
    /^Subject:\s/i
  ]);

  function looksLikeQuotedHeader(text) {
    const t = (text || '').trim();
    if (!t) return false;
    return QUOTED_HEADER_AFTER_HR_PATTERNS.some(re => re.test(t));
  }

  function markBoundariesPre(root) {
    root.querySelectorAll('blockquote, #divRplyFwdMsg').forEach(el => el.setAttribute('data-msg-boundary', '1'));
  }

  function applyPostFlattenMarks(nodes) {
    for (let i = 0; i < nodes.length - 1; i++) {
      if (nodes[i].tagName === 'HR' && nodes[i + 1].setAttribute && looksLikeQuotedHeader(nodes[i + 1].textContent)) {
        nodes[i + 1].setAttribute('data-msg-boundary', '1');
      }
    }
    nodes.forEach(n => {
      if (n.nodeType === 1 && isBoundaryText(n.textContent) && n.setAttribute) {
        n.setAttribute('data-msg-boundary', '1');
      }
    });
    let prevMarked = false;
    nodes.forEach(n => {
      let marked = n.getAttribute && n.getAttribute('data-msg-boundary') === '1';
      if (marked && prevMarked) {
        n.removeAttribute('data-msg-boundary');
        marked = false;
      }
      prevMarked = marked;
    });
  }

  function flattenBlocks(nodeList) {
    let result = [];
    nodeList.forEach(node => {
      if (node.nodeType === 1 && (node.tagName === 'DIV' || node.tagName === 'BLOCKQUOTE')) {
        const children = Array.prototype.filter.call(node.childNodes, c => !(c.nodeType === 3 && !c.textContent.trim()));
        const allBlockChildren = children.length >= 1 && children.every(c => c.nodeType === 1 && /^(DIV|P|UL|OL|TABLE|HR|BLOCKQUOTE)$/i.test(c.tagName));
        if (allBlockChildren) {
          const flattenedChildren = flattenBlocks(Array.prototype.slice.call(children));
          if (node.getAttribute && node.getAttribute('data-msg-boundary') === '1' && flattenedChildren.length) {
            const first = flattenedChildren[0];
            if (first.setAttribute) first.setAttribute('data-msg-boundary', '1');
          }
          result = result.concat(flattenedChildren);
          return;
        }
      }
      result.push(node);
    });
    return result;
  }

  function getBodyBlockNodes(bodyHtmlSanitized) {
    const container = document.createElement('div');
    container.innerHTML = bodyHtmlSanitized;
    markBoundariesPre(container);
    const nodes = [];
    Array.prototype.forEach.call(container.childNodes, n => {
      if (n.nodeType === 3) {
        if (!n.textContent.trim()) return;
        const span = document.createElement('div');
        span.textContent = n.textContent;
        nodes.push(span);
      } else if (n.nodeType === 1) {
        nodes.push(n);
      }
    });
    const flat = flattenBlocks(nodes);
    applyPostFlattenMarks(flat);
    return flat;
  }

  // ═══════════════════════════════════════════════════════════════
  // PDF GENERATION — pdf-lib, real LMC letterhead as page background
  // ═══════════════════════════════════════════════════════════════
  async function fetchBytes(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async function dataUrlToBytes(dataUrl) {
    const res = await fetch(dataUrl);
    return new Uint8Array(await res.arrayBuffer());
  }

  // Paginates content at the DOM level (block-node granularity, so lines
  // are never cut mid-way), rasterizes each page separately with
  // html2canvas, then composites each onto its own fresh copy of the
  // real letterhead PDF page via pdf-lib.
  async function buildPdfBlobForItem(item) {
    if (!window.html2canvas || !window.PDFLib) {
      throw new Error('PDF libraries not loaded');
    }

    const headerEl = buildHeaderEl(item);
    const bodyNodes = getBodyBlockNodes(sanitizeHtml(item.bodyHtml));

    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.left = '-99999px';
    stage.style.top = '0';
    stage.style.width = CONTENT_W_PX + 'px';
    stage.style.background = '#ffffff';
    stage.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
    stage.style.color = '#1a1a18';
    stage.style.fontSize = '13px';
    stage.style.lineHeight = '1.45';
    stage.className = 'eh-body';
    document.body.appendChild(stage);

    const pages = []; // { dataUrl, heightPx }
    let idx = 0;
    let pageIndex = 0;

    async function renderCurrentStage() {
      const canvas = await window.html2canvas(stage, { scale: RENDER_SCALE, useCORS: true, backgroundColor: '#ffffff' });
      pages.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.95), heightPx: stage.scrollHeight });
    }

    async function buildNextPage() {
      stage.innerHTML = '';
      let headerHeight = 0;
      if (pageIndex === 0) {
        stage.appendChild(headerEl);
        headerHeight = stage.scrollHeight;
      }
      const budget = USABLE_H_PX - headerHeight;
      let addedCount = 0;

      while (idx < bodyNodes.length) {
        const node = bodyNodes[idx];
        const forcedBreak = node.getAttribute && node.getAttribute('data-msg-boundary') === '1';
        if (forcedBreak && addedCount > 0) break;
        stage.appendChild(node);
        const h = stage.scrollHeight - headerHeight;
        if (h > budget && addedCount > 0) {
          stage.removeChild(node);
          break;
        }
        addedCount++;
        idx++;
        if (h > budget) break; // single oversized node: keep it alone on this page
      }

      await renderCurrentStage();
      pageIndex++;
      if (idx < bodyNodes.length) await buildNextPage();
    }

    try {
      await buildNextPage();
    } finally {
      document.body.removeChild(stage);
    }

    // Composite each rasterized page onto a fresh copy of the real
    // letterhead PDF page.
    const pdfDoc = await window.PDFLib.PDFDocument.create();
    const letterheadBytes = await fetchBytes(LETTERHEAD_URL);
    const [letterheadPage] = await pdfDoc.embedPdf(letterheadBytes, [0]);
    const PAGE_W = letterheadPage.width;
    const PAGE_H = letterheadPage.height;
    const PX_TO_PT = PAGE_W / PAGE_W_PX;
    const leftPt = LEFT_PAD_PX * PX_TO_PT;
    const topPt = TOP_PAD_PX * PX_TO_PT;
    const widthPt = CONTENT_W_PX * PX_TO_PT;

    for (const p of pages) {
      const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      page.drawPage(letterheadPage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
      const heightPt = p.heightPx * PX_TO_PT;
      const contentBytes = await dataUrlToBytes(p.dataUrl);
      const contentImage = await pdfDoc.embedJpg(contentBytes);
      page.drawImage(contentImage, { x: leftPt, y: PAGE_H - topPt - heightPt, width: widthPt, height: heightPt });
    }

    const bytes = await pdfDoc.save();
    return new Blob([bytes], { type: 'application/pdf' });
  }

  function safeFilename(name) {
    let n = (name || 'unnamed_client').trim();
    n = n.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim();
    return n || 'unnamed_client';
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadSingle(item) {
    const filename = safeFilename(item.clientName);
    buildPdfBlobForItem(item).then(blob => {
      triggerBlobDownload(blob, filename + '.pdf');
    }).catch(err => {
      console.error(err);
      alert('Failed to generate PDF for ' + item.file.name);
    });
  }

  function downloadAll() {
    if (!items.length) return;
    downloadAllBtn.disabled = true;
    const zip = new JSZip();
    const used = {};

    let chain = Promise.resolve();
    items.forEach((item, idx) => {
      chain = chain.then(() => {
        progressHint.textContent = 'Generating ' + (idx + 1) + ' / ' + items.length + '...';
        const baseName = safeFilename(item.clientName);
        let name = baseName;
        let counter = 2;
        while (used[name]) {
          name = baseName + ' (' + counter + ')';
          counter++;
        }
        used[name] = true;
        return buildPdfBlobForItem(item).then(blob => { zip.file(name + '.pdf', blob); });
      });
    });

    chain.then(() => {
      progressHint.textContent = 'Zipping...';
      return zip.generateAsync({ type: 'blob' });
    }).then(content => {
      triggerBlobDownload(content, 'eml-to-pdf-batch.zip');
      progressHint.textContent = 'Done.';
      setTimeout(() => { progressHint.textContent = ''; }, 3000);
    }).catch(err => {
      console.error(err);
      progressHint.textContent = '';
      alert('Failed to generate ZIP.');
    }).finally(() => {
      downloadAllBtn.disabled = false;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // EML PARSER
  // Reads raw ArrayBuffer, decodes as latin1 for structural (byte-preserving)
  // parsing, then re-decodes each MIME part's bytes using its declared charset.
  // ═══════════════════════════════════════════════════════════════
  function bufferToLatin1String(buf) {
    const bytes = new Uint8Array(buf);
    const chunks = [];
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
    }
    return chunks.join('');
  }

  function latin1StringToBytes(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
    return bytes;
  }

  function decodeBytesWithCharset(bytes, charset) {
    charset = (charset || 'utf-8').toLowerCase().replace(/^"|"$/g, '');
    const aliases = { 'iso-8859-1': 'iso-8859-1', 'windows-1252': 'windows-1252', 'cp1252': 'windows-1252', 'us-ascii': 'windows-1252', 'ascii': 'windows-1252', 'utf-8': 'utf-8', 'utf8': 'utf-8' };
    const enc = aliases[charset] || charset;
    try {
      return new TextDecoder(enc).decode(bytes);
    } catch (e) {
      try { return new TextDecoder('utf-8').decode(bytes); } catch (e2) { return latin1BytesToString(bytes); }
    }
  }
  function latin1BytesToString(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  function decodeQuotedPrintable(str) {
    str = str.replace(/=\r\n/g, '').replace(/=\n/g, '');
    str = str.replace(/=([0-9A-Fa-f]{2})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
    return str;
  }

  function decodeBase64ToLatin1(str) {
    const clean = str.replace(/[^A-Za-z0-9+/=]/g, '');
    try { return atob(clean); } catch (e) { return ''; }
  }

  function decodeMimeWords(str) {
    if (!str) return '';
    const re = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;
    str = str.replace(/(\?=)\s+(=\?)/g, '$1$2');
    return str.replace(re, (m, charset, enc, text) => {
      let bytesStr;
      if (enc.toUpperCase() === 'B') {
        bytesStr = decodeBase64ToLatin1(text);
      } else {
        const qp = text.replace(/_/g, ' ');
        bytesStr = decodeQuotedPrintable(qp);
      }
      const bytes = latin1StringToBytes(bytesStr);
      return decodeBytesWithCharset(bytes, charset);
    });
  }

  function parseHeaderBlock(raw) {
    const unfolded = raw.replace(/\r\n[ \t]+/g, ' ').replace(/\n[ \t]+/g, ' ');
    const lines = unfolded.split(/\r\n|\n/).filter(Boolean);
    const headers = {};
    lines.forEach(line => {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim();
      headers[key] = headers[key] ? headers[key] + ', ' + val : val;
    });
    return headers;
  }

  function splitHeaderBody(raw) {
    const m = raw.match(/\r?\n\r?\n/);
    if (!m) return { headerRaw: raw, bodyRaw: '' };
    const idx = raw.indexOf(m[0]);
    return { headerRaw: raw.slice(0, idx), bodyRaw: raw.slice(idx + m[0].length) };
  }

  function getBoundary(contentType) {
    const m = contentType && contentType.match(/boundary\s*=\s*"([^"]+)"|boundary\s*=\s*([^\s;]+)/i);
    if (!m) return null;
    return m[1] || m[2];
  }

  function getCharset(contentType) {
    const m = contentType && contentType.match(/charset\s*=\s*"?([^"\s;]+)"?/i);
    return m ? m[1] : 'utf-8';
  }

  function getContentTypeMain(contentType) {
    if (!contentType) return 'text/plain';
    return contentType.split(';')[0].trim().toLowerCase();
  }

  function parseMimeNode(headerRaw, bodyRaw, result) {
    const headers = parseHeaderBlock(headerRaw);
    const contentType = headers['content-type'] || 'text/plain';
    const mainType = getContentTypeMain(contentType);
    const cte = (headers['content-transfer-encoding'] || '7bit').trim().toLowerCase();

    if (mainType.indexOf('multipart/') === 0) {
      const boundary = getBoundary(contentType);
      if (!boundary) return;
      const delim = '--' + boundary;
      const parts = bodyRaw.split(delim);
      parts.forEach((part, i) => {
        if (i === 0) return;
        if (/^--/.test(part)) return;
        let partBody = part.replace(/^\r?\n/, '');
        partBody = partBody.replace(/\r?\n$/, '');
        const split = splitHeaderBody(partBody);
        if (!split.headerRaw.trim()) return;
        parseMimeNode(split.headerRaw, split.bodyRaw, result);
      });
      return;
    }

    let decodedLatin1;
    if (cte === 'quoted-printable') {
      decodedLatin1 = decodeQuotedPrintable(bodyRaw);
    } else if (cte === 'base64') {
      decodedLatin1 = decodeBase64ToLatin1(bodyRaw.replace(/[\r\n]/g, ''));
    } else {
      decodedLatin1 = bodyRaw;
    }
    const bytes = latin1StringToBytes(decodedLatin1);
    const charset = getCharset(contentType);
    const text = decodeBytesWithCharset(bytes, charset);

    if (mainType === 'text/html' && !result.textHtml) {
      result.textHtml = text;
    } else if (mainType === 'text/plain' && !result.textPlain) {
      result.textPlain = text;
    }
  }

  function plainTextToHtml(text) {
    const esc = escapeHtml(text);
    return "<div style='white-space:pre-wrap;'>" + esc.replace(/\r?\n/g, '\n') + '</div>';
  }

  function stripHtmlToText(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return div.textContent || div.innerText || '';
  }

  function extractEmailAddress(headerVal) {
    if (!headerVal) return '';
    const m = headerVal.match(/<([^>]+)>/);
    return m ? m[1] : headerVal.trim();
  }

  function extractDisplayName(headerVal) {
    if (!headerVal) return '';
    const decoded = decodeMimeWords(headerVal);
    const m = decoded.match(/^"?([^"<]*?)"?\s*<[^>]+>$/);
    if (m && m[1].trim()) return m[1].trim();
    return decoded.replace(/<[^>]+>/, '').trim();
  }

  function formatDate(headerVal) {
    if (!headerVal) return '';
    const d = new Date(headerVal);
    if (isNaN(d.getTime())) return headerVal;
    const opts = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return d.toLocaleString('en-US', opts);
  }

  function guessClientName(fullText) {
    if (!fullText) return '';
    const patterns = [
      /(?:Good day|Good\s+morning|Good\s+afternoon|Good\s+evening)\s+(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?)?\s*([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,6})\s*,/,
      /Dear\s+(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?)?\s*([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,6})\s*,/
    ];
    for (let i = 0; i < patterns.length; i++) {
      const m = fullText.match(patterns[i]);
      if (m && m[1]) return m[1].trim();
    }
    return '';
  }

  function parseEML(arrayBuffer) {
    const raw = bufferToLatin1String(arrayBuffer);
    const split = splitHeaderBody(raw);
    const headers = parseHeaderBlock(split.headerRaw);

    const result = { textPlain: '', textHtml: '' };
    parseMimeNode(split.headerRaw, split.bodyRaw, result);

    const bodyHtml = result.textHtml || (result.textPlain ? plainTextToHtml(result.textPlain) : '');
    const plainForSearch = result.textPlain || stripHtmlToText(result.textHtml);

    const fromEmail = extractEmailAddress(decodeMimeWords(headers['from'] || ''));
    const fromName = extractDisplayName(headers['from'] || '') || fromEmail;
    const toText = decodeMimeWords(headers['to'] || '');
    const subject = decodeMimeWords(headers['subject'] || '(no subject)');
    const dateText = formatDate(headers['date'] || '');

    const guessedName = guessClientName(plainForSearch);

    return { fromName, fromEmail, toText, subject, dateText, bodyHtml, guessedName };
  }

  // ═══════════════════════════════════════════════════════════════
  return {
    init: init
  };
})();
