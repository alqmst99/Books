/* ============================================================
   reader.js – LibroVivo
   Soporta: PDF binario local, PDF remoto con proxy,
            libros demo (sin PDF), HTML de Gutenberg
   ============================================================ */

let pdfDoc      = null;
let currentPage = 1;
let totalPages  = 0;
let scale       = 1.2;
let currentBook = null;
let isRendering = false;
let highlightMode = false;
let highlights  = [];
let bookKey     = '';

// Detectar raíz (estamos en pages/)
const ROOT = '../';

const canvas    = document.getElementById('pdfCanvas');
const ctx       = canvas?.getContext('2d');
const textLayer = document.getElementById('textLayer');

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  const params  = new URLSearchParams(window.location.search);
  const isLocal = params.get('local') === '1';
  const slug    = params.get('book');

  if (isLocal) {
    loadLocalPDF();
  } else if (slug) {
    currentBook = BOOKS.find(b => b.slug === slug);
    if (!currentBook) { showError('Libro no encontrado.'); return; }
    bookKey = `lv_reader_${slug}`;
    setupBookInfo();

    if (currentBook.demoOnly || !currentBook.pdf) {
      showDemoMode();
      return;
    }

    // Si es una URL de Gutenberg HTML, abrir en iframe
    if (currentBook.pdf && (currentBook.pdf.includes('.htm') || currentBook.pdf.includes('.html'))) {
      openHTMLBook(currentBook.pdf);
      return;
    }

    loadPDF(currentBook.pdf);
  } else {
    showError('No se especificó ningún libro.');
    return;
  }

  setupControls();
  if (bookKey) loadHighlights();
  setupTextSelection();
});

// ---- Libro demo (sin PDF disponible) ----
function showDemoMode() {
  showLoading(false);
  const container = document.getElementById('pdfContainer');
  if (container) container.style.display = 'none';

  const errorDiv = document.getElementById('readerError');
  errorDiv.style.display = 'flex';
  errorDiv.innerHTML = `
    <div class="lv-demo-mode">
      <i class="fas fa-book lv-error-icon" style="color:var(--gold)"></i>
      <h4 style="color:#fff">${currentBook.title}</h4>
      <p class="text-muted" style="max-width:40rem;line-height:1.7;margin:.8rem auto">
        ${currentBook.description}
      </p>
      <div class="lv-demo-meta">
        <span><i class="fas fa-user me-1"></i>${currentBook.author}</span>
        <span><i class="fas fa-calendar me-1"></i>${currentBook.year < 0 ? Math.abs(currentBook.year)+' a.C.' : currentBook.year}</span>
        <span><i class="fas fa-file-alt me-1"></i>${currentBook.pages} páginas</span>
      </div>
      <div class="lv-demo-notice">
        <i class="fas fa-info-circle me-2"></i>
        El PDF de este libro no está disponible como dominio público. 
        Puedes buscar una copia legal en tu biblioteca local.
      </div>
      <a href="../index.html" class="lv-btn-outline mt-3">
        <i class="fas fa-arrow-left me-2"></i>Volver al catálogo
      </a>
    </div>`;

  // Habilitar AI summary para libros demo también
  setupAIForDemo();
}

function setupAIForDemo() {
  document.getElementById('openAI')?.addEventListener('click', openAIModal);
  document.getElementById('generateSummary')?.addEventListener('click', openAIModal);
  document.getElementById('closeAiModal')?.addEventListener('click', () =>
    document.getElementById('aiModal').classList.remove('open'));
}

// ---- Abrir libro HTML de Gutenberg ----
function openHTMLBook(url) {
  showLoading(false);
  const container = document.getElementById('pdfContainer');
  if (container) container.style.display = 'none';

  const mainArea = document.getElementById('readerMain');
  const iframe   = document.createElement('iframe');
  iframe.src     = url;
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:#fff;border-radius:8px;flex:1';
  iframe.onload  = () => {};
  iframe.onerror = () => showError('No se pudo cargar el libro HTML.');

  // Quitar loading y mostrar iframe
  const loadDiv = document.getElementById('readerLoading');
  if (loadDiv) loadDiv.style.display = 'none';
  mainArea.appendChild(iframe);

  // Deshabilitar controles de página (no aplican para HTML)
  document.getElementById('prevPage').disabled = true;
  document.getElementById('nextPage').disabled = true;
  document.getElementById('pageInput').disabled = true;
  document.getElementById('totalPages').textContent = '—';

  setupAIForDemo();
}

// ---- Cargar PDF local (desde FileReader data URL o blob URL) ----
function loadLocalPDF() {
  let url  = null;
  const name = sessionStorage.getItem('lv_local_pdf_name') || 'Mi documento';

  // Intentar data URL primero, luego blob URL
  const dataUrl = sessionStorage.getItem('lv_local_pdf');
  const blobUrl  = sessionStorage.getItem('lv_local_pdf_url');

  if (dataUrl) {
    url = dataUrl;
  } else if (blobUrl) {
    url = blobUrl;
  } else {
    showError('No se encontró el PDF local. Por favor vuelve y selecciona el archivo nuevamente.');
    return;
  }

  bookKey = 'lv_reader_local';
  document.getElementById('readerTitle').textContent = name;
  document.getElementById('panelTitle').textContent  = name;
  document.getElementById('panelAuthor').textContent = 'Documento local';
  document.getElementById('panelCover').style.display = 'none';
  document.getElementById('panelBookInfo').style.display = 'block';

  loadPDF(url);
  setupAIForDemo();
}

// ---- Info del libro ----
function setupBookInfo() {
  if (!currentBook) return;
  document.title = `${currentBook.title} – LibroVivo`;
  document.getElementById('readerTitle').textContent   = currentBook.title;
  document.getElementById('panelTitle').textContent    = currentBook.title;
  document.getElementById('panelAuthor').textContent   = currentBook.author;
  document.getElementById('panelCategory').textContent = getCatLabel(currentBook.category);

  const cover   = document.getElementById('panelCover');
  cover.src     = currentBook.cover;
  cover.onerror = () => { cover.src = coverFallbackReader(currentBook.title); };
  document.getElementById('panelBookInfo').style.display = 'block';
}

function getCatLabel(id) {
  return CATEGORIES.find(c => c.id === id)?.label || id;
}

function coverFallbackReader(title) {
  const c = '%236B1E2B';
  const i = encodeURIComponent(title[0]?.toUpperCase() || '?');
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Crect width='300' height='450' fill='${c}'/%3E%3Ctext x='150' y='240' text-anchor='middle' font-family='serif' font-size='80' fill='rgba(255,255,255,.4)'%3E${i}%3C/text%3E%3C/svg%3E`;
}

// ---- Cargar PDF binario ----
async function loadPDF(url) {
  showLoading(true);
  try {
    const loadingTask = pdfjsLib.getDocument({ data: await fetchPDFData(url), withCredentials: false });
    pdfDoc     = await loadingTask.promise;
    totalPages = pdfDoc.numPages;
    document.getElementById('totalPages').textContent = totalPages;

    const saved = localStorage.getItem(bookKey + '_page');
    currentPage = saved ? Math.min(parseInt(saved), totalPages) : 1;

    await renderPage(currentPage);
    showLoading(false);
  } catch (err) {
    console.error('PDF load error:', err);
    showLoading(false);
    if (currentBook?.pdf?.includes('.htm')) {
      openHTMLBook(currentBook.pdf);
    } else {
      showError('No se pudo cargar el PDF. El archivo puede estar protegido o no disponible.');
    }
  }
}

// Obtener bytes del PDF usando fetch + proxy si hace falta
async function fetchPDFData(url) {
  // Data URL / blob URL – usar directamente
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    const res = await fetch(url);
    return await res.arrayBuffer();
  }

  // Intentar fetch directo primero
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) return await res.arrayBuffer();
  } catch (_) {}

  // Proxy CORS como fallback
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy);
      if (res.ok) return await res.arrayBuffer();
    } catch (_) {}
  }

  throw new Error('No se pudo obtener el PDF desde ningún proxy.');
}

// ---- Renderizar página ----
async function renderPage(num) {
  if (isRendering || !pdfDoc) return;
  isRendering = true;

  try {
    const page     = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale });

    canvas.height = viewport.height;
    canvas.width  = viewport.width;

    await page.render({ canvasContext: ctx, viewport }).promise;

    // Text layer
    textLayer.innerHTML = '';
    textLayer.style.width  = canvas.width  + 'px';
    textLayer.style.height = canvas.height + 'px';

    const textContent = await page.getTextContent();
    textContent.items.forEach(item => {
      const tx   = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const span = document.createElement('span');
      span.textContent  = item.str;
      span.style.left   = `${tx[4]}px`;
      span.style.top    = `${tx[5] - item.height * viewport.scale}px`;
      span.style.fontSize  = `${Math.abs(tx[0])}px`;
      span.style.fontFamily = item.fontName || 'sans-serif';
      const scaleX = tx[0] !== 0 && item.str.length > 0
        ? item.width * viewport.scale / (item.str.length * Math.abs(tx[0])) : 1;
      span.style.transform = `scaleX(${scaleX})`;
      textLayer.appendChild(span);
    });

    document.getElementById('pageInput').value = num;
    updateProgress();
    saveProgress(num);
  } catch (e) {
    console.error('Render error:', e);
  }
  isRendering = false;
}

// ---- Controles ----
function setupControls() {
  document.getElementById('prevPage')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderPage(currentPage); }
  });
  document.getElementById('nextPage')?.addEventListener('click', () => {
    if (currentPage < totalPages) { currentPage++; renderPage(currentPage); }
  });

  const pageInput = document.getElementById('pageInput');
  pageInput?.addEventListener('change', () => {
    const n = parseInt(pageInput.value);
    if (n >= 1 && n <= totalPages) { currentPage = n; renderPage(currentPage); }
    else pageInput.value = currentPage;
  });

  document.getElementById('zoomIn')?.addEventListener('click', () => {
    scale = Math.min(scale + .2, 3);
    document.getElementById('zoomVal').textContent = Math.round(scale * 100) + '%';
    renderPage(currentPage);
  });
  document.getElementById('zoomOut')?.addEventListener('click', () => {
    scale = Math.max(scale - .2, .5);
    document.getElementById('zoomVal').textContent = Math.round(scale * 100) + '%';
    renderPage(currentPage);
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && currentPage < totalPages) {
      currentPage++; renderPage(currentPage);
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && currentPage > 1) {
      currentPage--; renderPage(currentPage);
    }
  });

  const hlBtn = document.getElementById('highlightToggle');
  hlBtn?.addEventListener('click', () => {
    highlightMode = !highlightMode;
    hlBtn.classList.toggle('active', highlightMode);
    textLayer.style.cursor = highlightMode ? 'crosshair' : 'text';
  });

  document.getElementById('saveProgress')?.addEventListener('click', () => {
    saveProgress(currentPage);
    const btn = document.getElementById('saveProgress');
    btn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => btn.innerHTML = '<i class="fas fa-bookmark"></i>', 1500);
  });

  document.getElementById('openAI')?.addEventListener('click', openAIModal);
  document.getElementById('generateSummary')?.addEventListener('click', openAIModal);
  document.getElementById('closeAiModal')?.addEventListener('click', () =>
    document.getElementById('aiModal').classList.remove('open'));

  document.getElementById('openSidePanel')?.addEventListener('click', () => {
    document.getElementById('readerPanel')?.classList.toggle('open');
  });
}

function saveProgress(page) {
  if (!bookKey) return;
  try { localStorage.setItem(bookKey + '_page', page); } catch(_) {}
}

function updateProgress() {
  if (!totalPages) return;
  const pct = Math.round((currentPage / totalPages) * 100);
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressLabel').textContent = `Página ${currentPage} de ${totalPages} (${pct}%)`;
}

// ---- Text selection ----
function setupTextSelection() {
  const tooltip = document.getElementById('highlightTooltip');
  const doHL    = document.getElementById('doHighlight');
  const copyTx  = document.getElementById('copyText');

  document.addEventListener('mouseup', e => {
    const sel = window.getSelection();
    const txt = sel?.toString().trim();
    if (!txt || !textLayer?.contains(e.target)) {
      if (tooltip) tooltip.style.display = 'none';
      return;
    }
    if (tooltip) {
      tooltip.style.display = 'flex';
      tooltip.style.top  = (e.pageY - 50) + 'px';
      tooltip.style.left = e.pageX + 'px';
    }
  });

  doHL?.addEventListener('click', () => {
    const txt = window.getSelection()?.toString().trim();
    if (txt) addHighlight(txt);
    if (tooltip) tooltip.style.display = 'none';
    window.getSelection()?.removeAllRanges();
  });

  copyTx?.addEventListener('click', () => {
    const txt = window.getSelection()?.toString().trim();
    if (txt) navigator.clipboard?.writeText(txt).catch(() => {});
    if (tooltip) tooltip.style.display = 'none';
    window.getSelection()?.removeAllRanges();
  });

  document.addEventListener('mousedown', e => {
    if (tooltip && !tooltip.contains(e.target)) tooltip.style.display = 'none';
  });
}

function addHighlight(text) {
  const hl = { text, page: currentPage, date: new Date().toLocaleDateString('es') };
  highlights.push(hl);
  saveHighlights();
  renderHighlightsList();
}
function saveHighlights() {
  if (!bookKey) return;
  try { localStorage.setItem(bookKey + '_highlights', JSON.stringify(highlights)); } catch(_) {}
}
function loadHighlights() {
  if (!bookKey) return;
  try {
    const saved = localStorage.getItem(bookKey + '_highlights');
    if (saved) { highlights = JSON.parse(saved); renderHighlightsList(); }
  } catch(_) {}
}
function renderHighlightsList() {
  const list = document.getElementById('highlightsList');
  if (!list) return;
  if (!highlights.length) {
    list.innerHTML = '<p class="text-muted small">Selecciona texto en el lector para marcarlo.</p>';
    return;
  }
  list.innerHTML = highlights.map((h, i) => `
    <div class="lv-highlight-item" onclick="goToHighlightPage(${h.page})">
      <button class="lv-highlight-del" onclick="deleteHighlight(event,${i})"><i class="fas fa-times"></i></button>
      <small style="color:var(--gold-light)">Pág. ${h.page} · ${h.date}</small>
      <div style="margin-top:.3rem">"${h.text.slice(0,100)}${h.text.length>100?'…':''}"</div>
    </div>`).join('');
}
function deleteHighlight(e, idx) {
  e.stopPropagation();
  highlights.splice(idx, 1);
  saveHighlights();
  renderHighlightsList();
}
function goToHighlightPage(page) {
  currentPage = page;
  renderPage(currentPage);
}

// ---- AI Summary ----
async function openAIModal() {
  const modal = document.getElementById('aiModal');
  if (!modal) return;
  modal.classList.add('open');
  modal.querySelector('#aiLoading').style.display = 'flex';
  modal.querySelector('#aiResult').style.display  = 'none';

  const bookTitle  = currentBook?.title  || sessionStorage.getItem('lv_local_pdf_name') || 'este libro';
  const bookAuthor = currentBook?.author || '';
  const bookDesc   = currentBook?.description || '';

  let pageText = '';
  try {
    if (pdfDoc) {
      const page = await pdfDoc.getPage(currentPage);
      const tc   = await page.getTextContent();
      pageText   = tc.items.map(i => i.str).join(' ').slice(0, 1500);
    }
  } catch (_) {}

  const prompt = `Eres un asistente literario experto. Proporciona un resumen detallado y análisis del libro:

Título: "${bookTitle}"
${bookAuthor ? `Autor: ${bookAuthor}` : ''}
${bookDesc   ? `Descripción: ${bookDesc}` : ''}
${pageText   ? `\nTexto de muestra:\n"${pageText}"` : ''}

Incluye:
1. 📖 Resumen general (3-4 párrafos)
2. 🎯 Temas principales
3. ✨ Por qué vale la pena leerlo
4. 🧠 Lección o enseñanza principal

Responde en español de forma clara y atractiva. Usa formato markdown básico.`;

  try {
    const res  = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    const text = data?.content?.[0]?.text || 'No se pudo generar el resumen.';

    const aiPanel = document.getElementById('aiContent');
    if (aiPanel) aiPanel.innerHTML = `<div style="font-size:1.3rem;color:rgba(255,255,255,.75);line-height:1.8">${formatAI(text)}</div>`;

    modal.querySelector('#aiLoading').style.display = 'none';
    const result = modal.querySelector('#aiResult');
    result.innerHTML = formatAI(text);
    result.style.display = 'block';
  } catch (err) {
    modal.querySelector('#aiLoading').style.display = 'none';
    const result = modal.querySelector('#aiResult');
    result.innerHTML = `
      <div style="color:#888;text-align:center;padding:2rem">
        <i class="fas fa-exclamation-circle" style="font-size:3rem;color:#C9973A;display:block;margin-bottom:1rem"></i>
        <p>No se pudo conectar con la IA.</p>
        ${currentBook?.description ? `<p style="font-size:1.3rem;margin-top:1rem"><strong>Descripción:</strong><br>${currentBook.description}</p>` : ''}
      </div>`;
    result.style.display = 'block';
  }
}

function formatAI(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3} (.+)$/gm, '<h4 style="color:var(--borgogna);margin:.8rem 0 .4rem">$1</h4>')
    .replace(/\n/g, '<br>');
}

// ---- Loading / Error ----
function showLoading(show) {
  const el = document.getElementById('readerLoading');
  if (el) el.style.display = show ? 'flex' : 'none';
}
function showError(msg = 'No se pudo cargar el contenido.') {
  showLoading(false);
  const errDiv = document.getElementById('readerError');
  const pdfCon = document.getElementById('pdfContainer');
  if (pdfCon) pdfCon.style.display = 'none';
  if (errDiv) {
    errDiv.style.display = 'flex';
    const p = errDiv.querySelector('p.text-muted');
    if (p) p.textContent = msg;
  }
}
