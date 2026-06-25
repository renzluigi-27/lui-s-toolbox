// ─────────────────────────────────────────────────────────────────
// CLIENT ORGANIZER — client-organizer.js
// Reads a ZIP of PDFs, classifies by content, groups by client,
// splits lease forms, outputs a sorted ZIP.
// Depends on: PDF.js (pdfjsLib), JSZip
// ─────────────────────────────────────────────────────────────────

window.ClientOrganizer = (() => {

  // ── PDF.js worker setup ──
  function setupPdfWorker() {
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // INIT — mount UI into container div
  // ─────────────────────────────────────────────────────────────────
  function init(mountId) {
    setupPdfWorker();
    const el = document.getElementById(mountId);
    if (!el) return;
    el.innerHTML = `
      <div class="card">
        <div class="section-label">Upload Closing ZIP</div>
        <div class="upload-zone upload-zone-sm" id="coZipZone">
          <input type="file" id="coZipInput" accept=".zip" />
          <div class="upload-zone-text">
            <strong>Click to upload</strong>
            .zip file containing client PDFs
          </div>
        </div>
        <div class="file-loaded" id="coZipLoaded">
          <span>&#10003;</span>
          <div>
            <div class="file-loaded-name" id="coZipName">&mdash;</div>
            <div class="file-loaded-meta" id="coZipMeta">&mdash;</div>
          </div>
        </div>
        <div class="msg error" id="coZipError"></div>
      </div>

      <div class="card action-card">
        <button class="btn-primary" id="coRunBtn" disabled onclick="ClientOrganizer.run()">
          Organize Files
        </button>
        <div class="msg" id="coRunError"></div>
        <span class="generate-hint" id="coHint">Upload a ZIP file to continue</span>
      </div>

      <div id="coProgressCard" class="card" style="display:none;">
        <div class="section-label">Processing</div>
        <div id="coProgressText" style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">Starting...</div>
        <div style="background:var(--surface2);border-radius:6px;height:8px;overflow:hidden;">
          <div id="coProgressBar" style="height:100%;width:0%;background:var(--accent);transition:width 0.3s;border-radius:6px;"></div>
        </div>
      </div>

      <div id="coResultCard" class="card" style="display:none;">
        <div class="results-header">
          <div>
            <div class="section-label" style="margin-bottom:2px;">Results</div>
            <div class="results-title" id="coResultTitle">&mdash;</div>
          </div>
          <button class="btn-primary" onclick="ClientOrganizer.download()">&#8595; Download ZIP</button>
        </div>
        <div class="stats-grid" id="coStatsGrid"></div>
        <div id="coUnmatchedBox" style="display:none;">
          <div class="msg warn show" id="coUnmatchedMsg"></div>
        </div>
        <div class="table-wrap" style="margin-top:1rem;">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Contract No</th>
                <th>Container</th>
                <th>Files Found</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="coTableBody"></tbody>
          </table>
        </div>
      </div>
    `;

    const zone  = document.getElementById('coZipZone');
    const input = document.getElementById('coZipInput');
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handleZip(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', e => {
      if (e.target.files[0]) handleZip(e.target.files[0]);
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────
  let _zipFile   = null;
  let _outputZip = null;

  // ─────────────────────────────────────────────────────────────────
  // HANDLE ZIP UPLOAD
  // ─────────────────────────────────────────────────────────────────
  function handleZip(file) {
    coMsg('coZipError', '');
    if (!file.name.match(/\.zip$/i)) {
      coMsg('coZipError', 'Please upload a .zip file', 'error'); return;
    }
    _zipFile = file;
    document.getElementById('coZipLoaded').classList.add('show');
    document.getElementById('coZipName').textContent = file.name;
    document.getElementById('coZipMeta').textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
    document.getElementById('coRunBtn').disabled = false;
    document.getElementById('coHint').textContent = 'Ready to organize';
    document.getElementById('coResultCard').style.display = 'none';
    document.getElementById('coProgressCard').style.display = 'none';
  }

  // ─────────────────────────────────────────────────────────────────
  // MAIN RUN
  // ─────────────────────────────────────────────────────────────────
  async function run() {
    if (!_zipFile) return;
    coMsg('coRunError', '');
    document.getElementById('coResultCard').style.display = 'none';
    document.getElementById('coProgressCard').style.display = 'block';
    document.getElementById('coRunBtn').disabled = true;

    try {
      setProgress(0, 'Reading ZIP...');

      const zipData = await readFileAsArrayBuffer(_zipFile);
      const jszip   = new JSZip();
      const zip     = await jszip.loadAsync(zipData);

      const pdfEntries = [];
      zip.forEach((path, entry) => {
        if (!entry.dir && path.match(/\.pdf$/i)) {
          const filename = path.split('/').pop();
          pdfEntries.push({ path, filename, entry });
        }
      });

      setProgress(5, `Found ${pdfEntries.length} PDF files. Extracting text...`);

      const pdfRecords = [];
      for (let i = 0; i < pdfEntries.length; i++) {
        const { path, filename, entry } = pdfEntries[i];
        const pct = 5 + Math.round((i / pdfEntries.length) * 55);
        setProgress(pct, `Reading (${i + 1}/${pdfEntries.length}): ${filename}`);

        const rawBytes  = await entry.async('uint8array');
        const bytes     = rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength);
        const bytesCopy = bytes.slice(0);
        let text = '', pageCount = 0, pageTexts = [];
        try {
          const result = await extractPdfText(bytes);
          text      = result.fullText;
          pageCount = result.pageCount;
          pageTexts = result.pageTexts;
        } catch(e) { /* scanned/unreadable */ }

        pdfRecords.push({ path, filename, bytes: bytesCopy, text, pageCount, pageTexts, readable: text.trim().length > 50 });
      }

      setProgress(60, 'Classifying documents...');
      const classified = pdfRecords.map(r => ({ ...r, ...classifyPdf(r) }));

      setProgress(65, 'Building client groups from contracts...');
      const clientMap = buildClientMap(classified);

      setProgress(75, 'Matching invoices to clients...');
      const { unmatched } = matchToClients(classified, clientMap);

      setProgress(85, 'Assembling output ZIP...');
      const { outputZip, summary } = await buildOutputZip(unmatched, clientMap);
      _outputZip = outputZip;

      setProgress(100, 'Done!');
      renderResults(summary);

    } catch(err) {
      coMsg('coRunError', 'Error: ' + err.message, 'error');
      document.getElementById('coProgressCard').style.display = 'none';
      document.getElementById('coRunBtn').disabled = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PDF TEXT EXTRACTION
  // ─────────────────────────────────────────────────────────────────
  async function extractPdfText(arrayBuffer) {
    const pdf       = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;
    const pageTexts = [];
    for (let p = 1; p <= pageCount; p++) {
      const page    = await pdf.getPage(p);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map(i => i.str).join(' '));
    }
    return { fullText: pageTexts.join('\n'), pageCount, pageTexts };
  }

  // ─────────────────────────────────────────────────────────────────
  // CLASSIFY PDF
  // ─────────────────────────────────────────────────────────────────
  function classifyPdf({ filename, text, readable, pageTexts }) {
    const upper     = text.toUpperCase();
    const isScanned = !readable;
    let docType     = 'unknown';

    if (
      (upper.includes('CONTAINER RENTAL MANAGEMENT') || upper.includes('FACILITATION AGREEMENT') ||
       upper.includes('CONTAINER LEASE AGREEMENT')   || upper.includes('RENTAL MANAGEMENT')) &&
      (upper.includes('LEGEND MARITIME') || upper.includes('FIRST PARTY') || upper.includes('SECOND PARTY'))
    ) {
      docType = 'contract';
    } else if (upper.includes('LIBERTY SHIPPING CONTAINERS FZ-LLC') && upper.includes('INVOICE')) {
      docType = 'liberty_invoice';
    } else if (upper.includes('LEGEND MARITIME CARGO CONTAINERS RENTAL') && upper.includes('INVOICE') &&
               (upper.includes('PARKING FEE') || upper.includes('SERVICE FEE'))) {
      docType = 'lmc_invoice';
    } else if (!readable) {
      const fn = filename.toUpperCase();
      if (fn.includes('CONTRACT') || fn.includes('DRAFT') || fn.includes('AGREEMENT')) docType = 'contract';
      else if (fn.includes('LIBERTY') || fn.includes('VENDOR')) docType = 'liberty_invoice';
      else if ((fn.includes('LMC') && fn.includes('INVOICE')) || fn.includes('LEASE INVOICE')) docType = 'lmc_invoice';
    }

    const contractNo = extractContractNo(text, filename);

    let clientName = '';
    if      (docType === 'contract')       clientName = extractClientNameFromContract(text);
    else if (docType === 'liberty_invoice') clientName = extractClientNameFromLiberty(text);
    else if (docType === 'lmc_invoice')     clientName = extractClientNameFromLMC(text);
    if (!clientName) clientName = guessClientFromFilename(filename);

    let containerType = '';
    if      (docType === 'contract')       containerType = extractContainerTypeFromContract(text);
    else if (docType === 'liberty_invoice') containerType = extractContainerTypeFromLiberty(text);
    else if (docType === 'lmc_invoice')     containerType = extractContainerTypeFromLMC(text);

    let leaseFormPageIndex = -1;
    if (docType === 'contract' && pageTexts.length > 1) {
      for (let i = 0; i < pageTexts.length; i++) {
        if (pageTexts[i].toUpperCase().includes('LEASE FORM') &&
            pageTexts[i].toUpperCase().includes('ACCOUNT HOLDER')) {
          leaseFormPageIndex = i; break;
        }
      }
    }

    return { docType, clientName, containerType, contractNo, isScanned, leaseFormPageIndex };
  }

  // ─────────────────────────────────────────────────────────────────
  // EXTRACT HELPERS
  // ─────────────────────────────────────────────────────────────────
  function extractContractNo(text, filename) {
    const m = text.match(/CON[A-Z]{0,4}\d{3,6}/i) || filename.match(/CON[A-Z]{0,4}\d{3,6}/i);
    return m ? m[0].toUpperCase() : '';
  }

  function extractClientNameFromContract(text) {
    let m = text.match(/2[\\.]?\s*(?:Ms\.|Mr\.|Mrs\.|Dr\.)?\s*([A-Z][A-Z\s]{5,60}?)[\-–]/);
    if (m) return cleanName(m[1]);
    m = text.match(/(?:Second Party|Owner)[^:]*?[:\-–]\s*([A-Z][A-Z\s]{5,60}?)[\.\n,\-]/);
    if (m) return cleanName(m[1]);
    m = text.match(/AND\s+2[\\.]?\s*(?:Ms\.|Mr\.|Mrs\.|Dr\.)?\s*([A-Z][A-Z\s]{5,60})/i);
    if (m) return cleanName(m[1]);
    return '';
  }

  function extractClientNameFromLiberty(text) {
    const m = text.match(/Name\s*:\s*([A-Z][A-Z\s]{5,60}?)(?:\n|INVOICE|Company|Passport)/i);
    return m ? cleanName(m[1]) : '';
  }

  function extractClientNameFromLMC(text) {
    const m = text.match(/Name\s*:\s*([A-Z][A-Z\s]{5,60}?)(?:\n|Ph\s*:|Company|Passport)/i);
    return m ? cleanName(m[1]) : '';
  }

  function extractContainerTypeFromContract(text) {
    const typeM = text.match(/Container\s+type\s*:\s*([^\n\r]{3,40})/i);
    const sizeM = text.match(/Size\s*:\s*([^\n\r]{2,20})/i);
    if (typeM && sizeM) return normalizeContainerType(sizeM[1].trim() + ' ' + typeM[1].trim());
    const schedM = text.match(/(?:Type of Container|SCHEDULE.{0,5}A)[^\n]*\n[^\n]*\n?\s*([0-9]{2}FT[^\n]{2,30})/i);
    if (schedM) return normalizeContainerType(schedM[1].trim());
    const ftM = text.match(/(\d{2}\s*(?:FT|FEET|ft)[^\n,]{0,30})/i);
    if (ftM) return normalizeContainerType(ftM[1].trim());
    return '';
  }

  function extractContainerTypeFromLiberty(text) {
    const m = text.match(/(?:DESCRIPTION|description)\s*\n?([^\n]{5,60})/i);
    if (m) return normalizeContainerType(m[1].trim());
    const ftM = text.match(/(\d{2}\s*(?:FT|FEET|ft)[^\n,]{0,30})/i);
    if (ftM) return normalizeContainerType(ftM[1].trim());
    return '';
  }

  function extractContainerTypeFromLMC(text) {
    const ftM = text.match(/(\d{2}\s*(?:FT|FEET|ft)[^\n,]{0,30})/i);
    if (ftM) return normalizeContainerType(ftM[1].trim());
    return '';
  }

  function normalizeContainerType(raw) {
    let s = raw.replace(/[#\uf0b7\u2022\u00b7•]+/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/(\d{2})\s*(?:FEET|FT)/i, '$1ft');
    s = s.replace(/\b(Container|Unit|Shipping|New|Condition|Quantity)\b/gi, '').replace(/\s+/g, ' ').trim();
    s = s.replace(/[,.\-]+$/, '').trim();
    return s;
  }

  function cleanName(raw) {
    if (!raw) return '';
    let s = raw.trim();
    // Strip bullet/special chars first
    s = s.replace(/[#\uf0b7\u2022\u00b7•]+/g, ' ');
    // Loop to strip month+honorific combos
    for (let i = 0; i < 3; i++) {
      s = s.replace(/^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{0,4}\s*[-–\s]+/i, '');
      s = s.replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.|Miss|Engr\.)\s*/i, '');
    }
    // Strip trailing date leakage e.g. "12.06." or "12.06.2026"
    s = s.replace(/\s+\d{1,2}[.\-]\d{1,2}[.\-]?\d{0,4}\.*\s*$/, '');
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/[,.\-:]+$/, '').trim();
    return s.toUpperCase();
  }

  function guessClientFromFilename(filename) {
    let s = filename.replace(/\.pdf$/i, '');
    const prefixes = [
      /^LMC[\s_]*(Invoice|Contract|Draft|Services?|Container)[^A-Z]*/i,
      /^Liberty[\s_]*Invoice[\s_]*/i,
      /^Libery[\s_]*Invoice[\s_]*/i,
      /^LMC[\s_-]*/i,
      /^Mr\.?\s*/i,
      /^Mrs\.?\s*/i,
      /^Ms\.?\s*/i,
      /^Atfan[\s_]*/i,
      /FASLA[\s_]*Contract[\s_]*/i,
      /\d{4,}/g,
      /[\s_-]+\d+[A-Z]{3}\d{2,4}[\s_-]*/gi,
      /[\s_-]*\([^)]*\)/g,
      /[\s_-]*-\d+$/,
    ];
    for (const p of prefixes) s = s.replace(p, ' ');
    return s.replace(/\s+/g, ' ').trim().toUpperCase();
  }

  // ─────────────────────────────────────────────────────────────────
  // BUILD CLIENT MAP
  // ─────────────────────────────────────────────────────────────────
  function buildClientMap(classified) {
    const clientMap = new Map();
    const contracts = classified.filter(r => r.docType === 'contract');

    for (const c of contracts) {
      if (!c.clientName) continue;
      const key = normalizeClientKey(c.clientName);
      if (!clientMap.has(key)) {
        clientMap.set(key, { clientName: c.clientName, contractNos: new Set(), containers: new Map() });
      }
      const entry = clientMap.get(key);
      if (c.contractNo) entry.contractNos.add(c.contractNo);
      const ctype = c.containerType || 'Unknown Container';
      if (!entry.containers.has(ctype)) {
        entry.containers.set(ctype, { contract: null, libertyInvoice: null, lmcInvoice: null });
      }
      entry.containers.get(ctype).contract = c;
    }
    return clientMap;
  }

  // ─────────────────────────────────────────────────────────────────
  // MATCH INVOICES TO CLIENTS
  // ─────────────────────────────────────────────────────────────────
  function matchToClients(classified, clientMap) {
    const unmatched  = [];
    const nonContracts = classified.filter(r => r.docType !== 'contract');

    for (const doc of nonContracts) {
      if (!doc.clientName) {
        unmatched.push({ ...doc, reason: 'Could not extract client name' }); continue;
      }
      const key = normalizeClientKey(doc.clientName);
      if (!clientMap.has(key)) {
        const fuzzyKey = findFuzzyClient(key, clientMap);
        if (fuzzyKey) assignToClient(clientMap.get(fuzzyKey), doc);
        else unmatched.push({ ...doc, reason: `No matching contract for client: ${doc.clientName}` });
        continue;
      }
      assignToClient(clientMap.get(key), doc);
    }

    const unknowns = classified.filter(r => r.docType === 'unknown' && !r.readable);
    for (const doc of unknowns) {
      unmatched.push({ ...doc, reason: `Scanned or unreadable — check manually` });
    }

    return { unmatched };
  }

  function assignToClient(entry, doc) {
    const ctype = doc.containerType || '';
    let slot = null;
    if (ctype) {
      for (const [ct, s] of entry.containers) {
        if (normalizeContainerKey(ct) === normalizeContainerKey(ctype)) { slot = s; break; }
      }
    }
    if (!slot && entry.containers.size > 0) slot = entry.containers.values().next().value;
    if (!slot) {
      const key = ctype || 'Unknown Container';
      entry.containers.set(key, { contract: null, libertyInvoice: null, lmcInvoice: null });
      slot = entry.containers.get(key);
    }
    if (doc.docType === 'liberty_invoice') slot.libertyInvoice = doc;
    else if (doc.docType === 'lmc_invoice') slot.lmcInvoice = doc;
  }

  // ─────────────────────────────────────────────────────────────────
  // BUILD OUTPUT ZIP
  // ─────────────────────────────────────────────────────────────────
  async function buildOutputZip(unmatched, clientMap) {
    const outZip  = new JSZip();
    const summary = { clients: [], totalFiles: 0, unmatched: 0 };

    for (const [, entry] of clientMap) {
      const { clientName, contractNos, containers } = entry;

      for (const [containerType, slot] of containers) {
        const suffix = `(${containerType})`;

        if (slot.contract) {
          const { bytes, leaseFormPageIndex, pageCount } = slot.contract;
          if (leaseFormPageIndex >= 0 && pageCount > 1) {
            const contractPages = [], leasePages = [];
            for (let p = 0; p < pageCount; p++) {
              if (p === leaseFormPageIndex) leasePages.push(p + 1);
              else contractPages.push(p + 1);
            }
            const contractBytes = await extractPages(slot.contract.bytes.slice(0), contractPages);
            const leaseBytes    = await extractPages(slot.contract.bytes.slice(0), leasePages);
            outZip.file(`${clientName}/${clientName} - Contract ${suffix}.pdf`, contractBytes);
            outZip.file(`${clientName}/${clientName} - Lease Form ${suffix}.pdf`, leaseBytes);
            summary.totalFiles += 2;
          } else {
            outZip.file(`${clientName}/${clientName} - Contract ${suffix}.pdf`, bytes);
            summary.totalFiles++;
          }
        }

        if (slot.lmcInvoice) {
          outZip.file(`${clientName}/${clientName} - LMC Invoice ${suffix}.pdf`, slot.lmcInvoice.bytes);
          summary.totalFiles++;
        }
        if (slot.libertyInvoice) {
          outZip.file(`${clientName}/${clientName} - Liberty Invoice ${suffix}.pdf`, slot.libertyInvoice.bytes);
          summary.totalFiles++;
        }

        summary.clients.push({
          client:      clientName,
          contractNo:  [...contractNos].join(', ') || '—',
          container:   containerType,
          hasContract: !!slot.contract,
          hasLease:    slot.contract && slot.contract.leaseFormPageIndex >= 0,
          hasLMC:      !!slot.lmcInvoice,
          hasLiberty:  !!slot.libertyInvoice,
        });
      }
    }

    summary.unmatched = unmatched.length;
    for (const doc of unmatched) {
      const cno  = doc.contractNo || extractContractNo('', doc.filename);
      const hint = cno ? ` [Contract: ${cno}]` : '';
      outZip.file(`_UNMATCHED/${doc.filename}`, doc.bytes);
      outZip.file(`_UNMATCHED/${doc.filename}.note.txt`,
        `${doc.reason || 'Unknown reason'}${hint}\nOriginal filename: ${doc.filename}`);
      summary.totalFiles++;
    }

    return { outputZip: outZip, summary };
  }

  // ─────────────────────────────────────────────────────────────────
  // PAGE EXTRACTION via pdf-lib
  // ─────────────────────────────────────────────────────────────────
  async function extractPages(pdfBytes, pageNumbers) {
    if (window.PDFLib) {
      const { PDFDocument } = PDFLib;
      const srcDoc = await PDFDocument.load(pdfBytes.slice(0), { ignoreEncryption: true });
      const newDoc = await PDFDocument.create();
      const pages  = await newDoc.copyPages(srcDoc, pageNumbers.map(n => n - 1));
      pages.forEach(p => newDoc.addPage(p));
      return await newDoc.save();
    }
    return pdfBytes;
  }

  // ─────────────────────────────────────────────────────────────────
  // DOWNLOAD
  // ─────────────────────────────────────────────────────────────────
  async function download() {
    if (!_outputZip) return;
    const blob = await _outputZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'CLIENT_ORGANIZED_' + new Date().toISOString().slice(0,10) + '.zip';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER RESULTS
  // ─────────────────────────────────────────────────────────────────
  function renderResults(summary) {
    document.getElementById('coProgressCard').style.display = 'none';
    document.getElementById('coResultCard').style.display  = 'block';
    document.getElementById('coRunBtn').disabled = false;

    const clientCount = new Set(summary.clients.map(c => c.client)).size;
    document.getElementById('coResultTitle').textContent =
      `${clientCount} client(s) · ${summary.totalFiles} files organized`;

    document.getElementById('coStatsGrid').innerHTML = [
      { val: clientCount,        lbl: 'Clients' },
      { val: summary.totalFiles, lbl: 'Files' },
      { val: summary.unmatched,  lbl: 'Unmatched' },
      { val: summary.clients.filter(c => c.hasLease).length, lbl: 'Lease Forms Split' },
    ].map(s => `<div class="stat-box"><span class="stat-val">${s.val}</span><span class="stat-lbl">${s.lbl}</span></div>`).join('');

    if (summary.unmatched > 0) {
      document.getElementById('coUnmatchedBox').style.display = 'block';
      document.getElementById('coUnmatchedMsg').textContent =
        `⚠ ${summary.unmatched} file(s) could not be matched — check _UNMATCHED/ folder.`;
    } else {
      document.getElementById('coUnmatchedBox').style.display = 'none';
    }

    document.getElementById('coTableBody').innerHTML = summary.clients.map(c => {
      const files = [
        c.hasContract ? '✓ Contract'         : '✗ Contract',
        c.hasLease    ? '✓ Lease Form'        : '— Lease Form',
        c.hasLMC      ? '✓ LMC Invoice'       : '✗ LMC Invoice',
        c.hasLiberty  ? '✓ Liberty Invoice'   : '✗ Liberty Invoice',
      ].join('<br>');
      const badge = (c.hasContract && c.hasLMC && c.hasLiberty)
        ? `<span class="badge badge-ok">Complete</span>`
        : `<span class="badge badge-warn">Partial</span>`;
      return `<tr>
        <td class="td-name">${esc(c.client)}</td>
        <td class="td-mono">${esc(c.contractNo)}</td>
        <td>${esc(c.container)}</td>
        <td style="font-size:11px;line-height:1.8;">${files}</td>
        <td>${badge}</td>
      </tr>`;
    }).join('');

    document.getElementById('coResultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ─────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────
  function normalizeClientKey(name) {
    return name.toUpperCase().replace(/\s+/g, ' ').trim();
  }
  function normalizeContainerKey(ct) {
    return ct.toUpperCase().replace(/\s+/g, ' ').trim();
  }
  function findFuzzyClient(key, clientMap) {
    for (const [k] of clientMap) {
      const a = key.replace(/\s/g, ''), b = k.replace(/\s/g, '');
      if (a.includes(b) || b.includes(a)) return k;
      const wa = key.split(' ').slice(0,3).join(' ');
      const wb = k.split(' ').slice(0,3).join(' ');
      if (wa === wb && wa.length > 5) return k;
    }
    return null;
  }
  function readFileAsArrayBuffer(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = () => rej(new Error('File read error'));
      r.readAsArrayBuffer(file);
    });
  }
  function setProgress(pct, text) {
    document.getElementById('coProgressBar').style.width  = pct + '%';
    document.getElementById('coProgressText').textContent = text;
  }
  function coMsg(id, text, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className   = 'msg' + (text ? ` show ${type || 'error'}` : '');
  }
  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init, run, download };

})();
