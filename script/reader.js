/* ============================================================
   reader.js – LibroVivo
   Soporta: PDF binario local, PDF remoto con proxy,
            libros demo (sin PDF), HTML de Gutenberg
   ============================================================ */

let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let scale = 1.0; // relative multiplier on top of fit-to-width
let fitMode = "width"; // "width" | "custom"
let currentBook = null;
let isRendering = false;
let highlightMode = false;
let highlights = [];
let bookKey = "";
const GROQ_KEY_STORAGE = "lv_groq_api_key";

// Detectar raíz (estamos en pages/)
const ROOT = "../";

const canvas = document.getElementById("pdfCanvas");
const ctx = canvas?.getContext("2d");
const textLayer = document.getElementById("textLayer");

// ---- Init ----
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const isLocal = params.get("local") === "1";
  const slug = params.get("book");

  if (isLocal) {
    loadLocalPDF();
  } else if (slug) {
    currentBook = BOOKS.find((b) => b?.slug === slug);
    if (!currentBook) {
      showError("Libro no encontrado.");
      return;
    }
    bookKey = `lv_reader_${slug}`;
    setupBookInfo();

    if (currentBook.demoOnly || !currentBook.pdf) {
      showDemoMode();
      return;
    }

    // Si es una URL de Gutenberg HTML, abrir en iframe
    if (
      currentBook.pdf &&
      (currentBook.pdf.includes(".htm") || currentBook.pdf.includes(".html"))
    ) {
      openHTMLBook(currentBook.pdf);
      return;
    }

    loadPDF(currentBook.pdf);
  } else {
    showError("No se especificó ningún libro.");
    return;
  }

  setupControls();
  if (bookKey) loadHighlights();
  setupTextSelection();
});

// ---- Libro demo (sin PDF disponible) ----
function showDemoMode() {
  showLoading(false);
  const container = document.getElementById("pdfContainer");
  if (container) container.style.display = "none";

  const errorDiv = document.getElementById("readerError");
  errorDiv.style.display = "flex";
  errorDiv.innerHTML = `
    <div class="lv-demo-mode">
      <i class="fas fa-book lv-error-icon" style="color:var(--gold)"></i>
      <h4 style="color:#fff">${currentBook.title}</h4>
      <p class="text-muted" style="max-width:40rem;line-height:1.7;margin:.8rem auto">
        ${currentBook.description}
      </p>
      <div class="lv-demo-meta">
        <span><i class="fas fa-user me-1"></i>${currentBook.author}</span>
        <span><i class="fas fa-calendar me-1"></i>${currentBook.year < 0 ? Math.abs(currentBook.year) + " a.C." : currentBook.year}</span>
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
  document.getElementById("openAI")?.addEventListener("click", openAIModal);
  document
    .getElementById("generateSummary")
    ?.addEventListener("click", openAIModal);
  document
    .getElementById("closeAiModal")
    ?.addEventListener("click", () =>
      document.getElementById("aiModal").classList.remove("open"),
    );
}

// ---- Abrir libro HTML de Gutenberg DENTRO del lector ----
// Gutenberg bloquea iframes; traemos el HTML/PDF por proxy y lo mostramos aquí.
let htmlPages = [];
let htmlMode = false;
let epubMode = false;
let epubBook = null;
let epubRendition = null;

function extractGutenbergId(url) {
  const m = String(url || "").match(/\/(?:files|ebooks|epub|cache\/epub)\/(\d+)/);
  return m ? m[1] : null;
}

function gutenbergCandidates(id, originalUrl) {
  const list = [];
  if (id) {
    // EPUB (preferido para lectura in-app)
    list.push(`https://www.gutenberg.org/cache/epub/${id}/pg${id}-images.epub`);
    list.push(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.epub`);
    list.push(`https://www.gutenberg.org/ebooks/${id}.epub.images`);
    list.push(`https://www.gutenberg.org/ebooks/${id}.epub.noimages`);
    // PDFs
    list.push(`https://www.gutenberg.org/files/${id}/${id}-pdf.pdf`);
    list.push(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.pdf`);
    // HTML
    list.push(`https://www.gutenberg.org/files/${id}/${id}-h/${id}-h.htm`);
    list.push(`https://www.gutenberg.org/cache/epub/${id}/pg${id}-images.html`);
    list.push(`https://www.gutenberg.org/files/${id}/${id}-h/${id}-h.html`);
    // Texto
    list.push(`https://www.gutenberg.org/files/${id}/${id}-0.txt`);
    list.push(`https://www.gutenberg.org/files/${id}/${id}.txt`);
    list.push(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`);
  }
  if (originalUrl && !list.includes(originalUrl)) list.unshift(originalUrl);
  return list;
}

async function fetchTextViaProxy(url) {
  // Proxies CORS públicos (orden: directo → HTML completo → texto)
  const proxies = [
    { build: (u) => u, asText: false },
    { build: (u) => `https://proxy.cors.sh/${u}`, asText: false },
    { build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, asText: false },
    { build: (u) => `https://r.jina.ai/${u}`, asText: true }, // markdown/texto legible
  ];
  let lastErr = null;
  for (const { build, asText } of proxies) {
    try {
      const res = await fetch(build(url), {
        method: "GET",
        headers: { "x-requested-with": "XMLHttpRequest" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!asText && (ct.includes("pdf") || url.endsWith(".pdf"))) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength < 500) throw new Error("PDF vacío");
        // Validar cabecera PDF
        const head = new Uint8Array(buf.slice(0, 5));
        const sig = String.fromCharCode(...head);
        if (!sig.startsWith("%PDF")) throw new Error("No es PDF");
        return { type: "pdf", data: buf };
      }
      const text = await res.text();
      if (!text || text.length < 80) throw new Error("Respuesta vacía");
      if (/error\s*404|page not found|does not have the page/i.test(text) && text.length < 2500) {
        throw new Error("404 en respuesta");
      }
      // Evitar páginas de proxies basura
      if (/hidemy\.name|corsproxy\.io\/pricing/i.test(text) && text.length < 100000) {
        throw new Error("Proxy devolvió página intermedia");
      }
      const type = asText || url.endsWith(".txt") ? "text" : "html";
      return { type, data: text, sourceUrl: url };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No se pudo obtener el contenido");
}

function sanitizeGutenbergHtml(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, link, noscript, iframe, object, embed").forEach((n) => n.remove());
  // Quitar chrome típico de Gutenberg
  doc.querySelectorAll(
    "#pg-header, #pg-footer, .pg-header, .pg-footer, [id*='pg-header'], [id*='pg-footer']"
  ).forEach((n) => n.remove());

  // Absolutizar imágenes y links relativos
  const base = baseUrl.replace(/\/[^/]*$/, "/");
  doc.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src") || "";
    if (src && !/^https?:|^data:/i.test(src)) {
      try { img.src = new URL(src, base).href; } catch (_) {}
    }
  });

  const body = doc.body;
  if (!body) return html;
  // Preferir el contenido principal
  const main =
    body.querySelector("[role='main']") ||
    body.querySelector(".chapter") ||
    body;
  return main.innerHTML || body.innerHTML;
}

function splitIntoPages(htmlOrText, isPlainText) {
  const PAGE_CHARS = 3200;
  if (isPlainText) {
    const clean = htmlOrText
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const pages = [];
    let i = 0;
    while (i < clean.length) {
      let end = Math.min(i + PAGE_CHARS, clean.length);
      if (end < clean.length) {
        const slice = clean.lastIndexOf("\n\n", end);
        if (slice > i + 800) end = slice;
      }
      const chunk = clean.slice(i, end).trim();
      if (chunk) {
        pages.push(
          `<pre class="lv-html-plain">${chunk
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</pre>`
        );
      }
      i = end;
    }
    return pages.length ? pages : ["<p>(Sin contenido)</p>"];
  }

  // HTML: partir por bloques
  const wrap = document.createElement("div");
  wrap.innerHTML = htmlOrText;
  const blocks = [...wrap.children];
  if (!blocks.length) {
    // texto suelto
    const t = wrap.textContent || "";
    return splitIntoPages(t, true);
  }

  const pages = [];
  let buf = "";
  let len = 0;
  const flush = () => {
    if (buf.trim()) pages.push(buf);
    buf = "";
    len = 0;
  };
  for (const el of blocks) {
    const piece = el.outerHTML;
    const l = (el.textContent || "").length;
    if (len + l > PAGE_CHARS && buf) flush();
    buf += piece;
    len += l;
    // capítulos largos: forzar corte
    if (len > PAGE_CHARS * 1.6) flush();
  }
  flush();
  return pages.length ? pages : [htmlOrText];
}

function ensureHtmlReaderDom() {
  const mainArea = document.getElementById("readerMain");
  let view = document.getElementById("htmlReaderView");
  if (!view && mainArea) {
    view = document.createElement("div");
    view.id = "htmlReaderView";
    view.className = "lv-html-reader";
    mainArea.appendChild(view);
  }
  return view;
}

function renderHtmlPage(num) {
  const view = ensureHtmlReaderDom();
  if (!view || !htmlPages.length) return;
  currentPage = Math.max(1, Math.min(num, htmlPages.length));
  view.innerHTML = `<article class="lv-html-page">${htmlPages[currentPage - 1]}</article>`;
  view.scrollTop = 0;
  const pageInput = document.getElementById("pageInput");
  if (pageInput) pageInput.value = currentPage;
  const tot = document.getElementById("totalPages");
  if (tot) tot.textContent = String(htmlPages.length);
  updateProgress();
  saveProgress(currentPage);
}

async function fetchBinaryViaProxy(url) {
  const proxies = [
    (u) => u,
    (u) => `https://proxy.cors.sh/${u}`,
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  ];
  let lastErr = null;
  for (const build of proxies) {
    try {
      const res = await fetch(build(url), {
        method: "GET",
        headers: { "x-requested-with": "XMLHttpRequest" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 500) throw new Error("archivo vacío");
      return buf;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No se pudo descargar");
}

function ensureEpubDom() {
  const mainArea = document.getElementById("readerMain");
  let view = document.getElementById("epubViewer");
  if (!view && mainArea) {
    view = document.createElement("div");
    view.id = "epubViewer";
    view.className = "lv-epub-viewer";
    mainArea.appendChild(view);
  }
  return view;
}

async function openEpubFromBuffer(buf) {
  if (typeof ePub === "undefined") throw new Error("epub.js no cargado");
  epubMode = true;
  htmlMode = false;
  const container = document.getElementById("pdfContainer");
  if (container) container.style.display = "none";
  const htmlView = document.getElementById("htmlReaderView");
  if (htmlView) htmlView.style.display = "none";
  const err = document.getElementById("readerError");
  if (err) err.style.display = "none";

  const view = ensureEpubDom();
  view.innerHTML = "";
  view.style.display = "block";

  if (epubBook) {
    try { epubBook.destroy(); } catch (_) {}
  }
  epubBook = ePub(buf);
  epubRendition = epubBook.renderTo(view, {
    width: "100%",
    height: "100%",
    flow: "paginated",
    allowScriptedContent: false,
  });
  await epubRendition.display();

  // páginas aproximadas
  try {
    await epubBook.ready;
    const spine = epubBook.spine;
    totalPages = spine?.length || 1;
  } catch (_) {
    totalPages = 1;
  }
  currentPage = 1;
  const tot = document.getElementById("totalPages");
  if (tot) tot.textContent = String(totalPages);
  const pageInput = document.getElementById("pageInput");
  if (pageInput) pageInput.value = "1";
  updateProgress();
  showLoading(false);
}

async function openHTMLBook(url) {
  showLoading(true);
  htmlMode = true;
  epubMode = false;
  htmlPages = [];

  const container = document.getElementById("pdfContainer");
  if (container) container.style.display = "none";
  const err = document.getElementById("readerError");
  if (err) err.style.display = "none";

  const id = extractGutenbergId(url);
  const candidates = gutenbergCandidates(id, url);

  // 1) EPUB primero
  if (typeof ePub !== "undefined") {
    for (const cand of candidates.filter((u) => /\.epub/i.test(u))) {
      try {
        const buf = await fetchBinaryViaProxy(cand);
        // ZIP signature PK
        const head = new Uint8Array(buf.slice(0, 2));
        if (head[0] !== 0x50 || head[1] !== 0x4b) continue;
        await openEpubFromBuffer(buf);
        setupControls();
        setupAIForDemo();
        return;
      } catch (e) {
        console.warn("EPUB fail", cand, e);
      }
    }
  }

  // 2) PDF
  for (const cand of candidates.filter((u) => u.endsWith(".pdf"))) {
    try {
      const result = await fetchTextViaProxy(cand);
      if (result.type === "pdf") {
        htmlMode = false;
        epubMode = false;
        const blob = new Blob([result.data], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);
        await loadPDF(blobUrl);
        setupControls();
        return;
      }
    } catch (_) {}
  }

  // 3) HTML o texto
  let loaded = null;
  for (const cand of candidates.filter((u) => !u.endsWith(".pdf") && !/\.epub/i.test(u))) {
    try {
      loaded = await fetchTextViaProxy(cand);
      if (loaded) break;
    } catch (_) {}
  }

  if (!loaded) {
    showLoading(false);
    showError(
      "No se pudo cargar el libro desde Project Gutenberg. Probá de nuevo más tarde o abrí el catálogo."
    );
    setupAIForDemo();
    return;
  }

  let pages;
  if (loaded.type === "text") {
    pages = splitIntoPages(loaded.data, true);
  } else {
    const clean = sanitizeGutenbergHtml(loaded.data, loaded.sourceUrl || url);
    pages = splitIntoPages(clean, false);
  }

  htmlPages = pages;
  totalPages = pages.length;
  showLoading(false);

  const view = ensureHtmlReaderDom();
  if (view) view.style.display = "block";

  // Controles de página activos
  ["prevPage", "nextPage", "pageInput"].forEach((idEl) => {
    const el = document.getElementById(idEl);
    if (el) el.disabled = false;
  });

  const saved = bookKey ? localStorage.getItem(bookKey + "_page") : null;
  const startPage = saved ? Math.min(parseInt(saved, 10) || 1, totalPages) : 1;
  renderHtmlPage(startPage);
  setupAIForDemo();
  setupControls();
}

// ---- Cargar PDF local (desde FileReader data URL o blob URL) ----
function loadLocalPDF() {
  let url = null;
  const name = sessionStorage.getItem("lv_local_pdf_name") || "Mi documento";

  // Intentar data URL primero, luego blob URL
  const dataUrl = sessionStorage.getItem("lv_local_pdf");
  const blobUrl = sessionStorage.getItem("lv_local_pdf_url");

  if (dataUrl) {
    url = dataUrl;
  } else if (blobUrl) {
    url = blobUrl;
  } else {
    showError(
      "No se encontró el PDF local. Por favor vuelve y selecciona el archivo nuevamente.",
    );
    return;
  }

  bookKey = "lv_reader_local";
  document.getElementById("readerTitle").textContent = name;
  document.getElementById("panelTitle").textContent = name;
  document.getElementById("panelAuthor").textContent = "Documento local";
  document.getElementById("panelCover").style.display = "none";
  document.getElementById("panelBookInfo").style.display = "block";

  loadPDF(url);
  setupAIForDemo();
}

// ---- Info del libro ----
function setupBookInfo() {
  if (!currentBook) return;
  document.title = `${currentBook.title} – LibroVivo`;
  document.getElementById("readerTitle").textContent = currentBook.title;
  document.getElementById("panelTitle").textContent = currentBook.title;
  document.getElementById("panelAuthor").textContent = currentBook.author;
  document.getElementById("panelCategory").textContent = getCatLabel(
    currentBook.category,
  );

  const cover = document.getElementById("panelCover");
  cover.src = currentBook.cover;
  cover.onerror = () => {
    cover.src = coverFallbackReader(currentBook.title);
  };
  document.getElementById("panelBookInfo").style.display = "block";
}

function getCatLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label || id;
}

function coverFallbackReader(title) {
  const c = "%236B1E2B";
  const i = encodeURIComponent(title[0]?.toUpperCase() || "?");
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Crect width='300' height='450' fill='${c}'/%3E%3Ctext x='150' y='240' text-anchor='middle' font-family='serif' font-size='80' fill='rgba(255,255,255,.4)'%3E${i}%3C/text%3E%3C/svg%3E`;
}

// ---- Cargar PDF binario ----
async function loadPDF(url) {
  showLoading(true);
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: await fetchPDFData(url),
      withCredentials: false,
    });
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;
    document.getElementById("totalPages").textContent = totalPages;

    const saved = localStorage.getItem(bookKey + "_page");
    currentPage = saved ? Math.min(parseInt(saved), totalPages) : 1;

    await renderPage(currentPage);
    showLoading(false);
  } catch (err) {
    console.error("PDF load error:", err);
    showLoading(false);
    if (currentBook?.pdf?.includes(".htm")) {
      openHTMLBook(currentBook.pdf);
    } else {
      showError(
        "No se pudo cargar el PDF. El archivo puede estar protegido o no disponible.",
      );
    }
  }
}

// Obtener bytes del PDF usando fetch + proxy si hace falta
async function fetchPDFData(url) {
  // Data URL / blob URL – usar directamente
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    const res = await fetch(url);
    return await res.arrayBuffer();
  }

  // Intentar fetch directo primero
  try {
    const res = await fetch(url, { mode: "cors" });
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

  throw new Error("No se pudo obtener el PDF desde ningún proxy.");
}

// ---- Renderizar página ----
async function renderPage(num) {
  if (isRendering || !pdfDoc || !canvas || !ctx) return;
  isRendering = true;

  try {
    const page = await pdfDoc.getPage(num);
    const container = document.getElementById("pdfContainer");
    const mainArea = document.getElementById("readerMain");

    // Ancho disponible (padding del main ~ 4rem)
    const availableWidth = Math.max(
      (container?.parentElement?.clientWidth || mainArea?.clientWidth || 800) - 48,
      280
    );

    const baseViewport = page.getViewport({ scale: 1 });
    const fitScale = availableWidth / baseViewport.width;
    const finalScale = fitMode === "width" ? fitScale * scale : scale * fitScale;
    const viewport = page.getViewport({ scale: finalScale });

    // HiDPI
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = Math.floor(viewport.width) + "px";
    canvas.style.height = Math.floor(viewport.height) + "px";
    ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);

    await page.render({ canvasContext: ctx, viewport }).promise;

    if (container) {
      container.style.width = Math.floor(viewport.width) + "px";
      container.style.margin = "0 auto";
    }
    canvas.style.display = "block";
    canvas.style.margin = "0 auto";

    // Text layer alineado al viewport final
    if (textLayer) {
      textLayer.innerHTML = "";
      textLayer.style.width = Math.floor(viewport.width) + "px";
      textLayer.style.height = Math.floor(viewport.height) + "px";
      textLayer.style.transform = "none";

      try {
        const textContent = await page.getTextContent();
        const textViewport = viewport;
        textContent.items.forEach((item) => {
          if (!item.str) return;
          const tx = pdfjsLib.Util.transform(textViewport.transform, item.transform);
          const span = document.createElement("span");
          span.textContent = item.str;
          span.style.left = `${tx[4]}px`;
          span.style.top = `${tx[5] - (item.height || Math.abs(tx[0]))}px`;
          span.style.fontSize = `${Math.abs(tx[0])}px`;
          span.style.fontFamily = "sans-serif";
          const scaleX =
            tx[0] !== 0 && item.str.length > 0
              ? (item.width * textViewport.scale) / (item.str.length * Math.abs(tx[0]))
              : 1;
          span.style.transform = `scaleX(${scaleX})`;
          textLayer.appendChild(span);
        });
      } catch (_) {}
    }

    const zoomEl = document.getElementById("zoomVal");
    if (zoomEl) zoomEl.textContent = Math.round(scale * 100) + "%";

    document.getElementById("pageInput").value = num;
    updateProgress();
    saveProgress(num);
  } catch (e) {
    console.error("Render error:", e);
  }
  isRendering = false;
}

//bookmark
function addBookmark() {
  const key = bookKey + "_bookmarks";
  let list = JSON.parse(localStorage.getItem(key) || "[]");

  list.push({
    page: currentPage,
    date: new Date().toLocaleString(),
  });

  localStorage.setItem(key, JSON.stringify(list));
}

// ---- Navegación unificada (PDF o HTML) ----
function goToPage(num) {
  if (epubMode && epubRendition) {
    currentPage = Math.max(1, Math.min(num, totalPages || 1));
    if (num > (parseInt(document.getElementById("pageInput")?.value || "1", 10) || 1)) {
      epubRendition.next();
    } else if (num < (parseInt(document.getElementById("pageInput")?.value || "1", 10) || 1)) {
      epubRendition.prev();
    } else {
      // saltar por spine index si es posible
      try {
        const item = epubBook?.spine?.get(currentPage - 1);
        if (item) epubRendition.display(item.href);
        else epubRendition.display(currentPage - 1);
      } catch (_) {
        epubRendition.display(currentPage - 1);
      }
    }
    const pageInput = document.getElementById("pageInput");
    if (pageInput) pageInput.value = currentPage;
    updateProgress();
    saveProgress(currentPage);
    return;
  }
  if (htmlMode) {
    renderHtmlPage(num);
    return;
  }
  if (pdfDoc) renderPage(num);
}

let controlsReady = false;

// ---- Controles ----
function setupControls() {
  if (controlsReady) return;
  controlsReady = true;

  document.getElementById("prevPage")?.addEventListener("click", () => {
    if (epubMode && epubRendition) {
      epubRendition.prev();
      currentPage = Math.max(1, currentPage - 1);
      const pageInput = document.getElementById("pageInput");
      if (pageInput) pageInput.value = currentPage;
      updateProgress();
      saveProgress(currentPage);
      return;
    }
    if (currentPage > 1) goToPage(currentPage - 1);
  });
  document.getElementById("nextPage")?.addEventListener("click", () => {
    if (epubMode && epubRendition) {
      epubRendition.next();
      currentPage = Math.min(totalPages || currentPage + 1, currentPage + 1);
      const pageInput = document.getElementById("pageInput");
      if (pageInput) pageInput.value = currentPage;
      updateProgress();
      saveProgress(currentPage);
      return;
    }
    if (currentPage < totalPages) goToPage(currentPage + 1);
  });

  document.getElementById("fullscreenBtn")?.addEventListener("click", toggleFullscreen);

  document.getElementById("fitWidthBtn")?.addEventListener("click", () => {
    if (htmlMode) {
      const view = document.getElementById("htmlReaderView");
      if (view) view.classList.toggle("lv-html-wide");
      return;
    }
    scale = 1.0;
    fitMode = "width";
    goToPage(currentPage);
  });

  const pageInput = document.getElementById("pageInput");
  pageInput?.addEventListener("change", () => {
    const n = parseInt(pageInput.value, 10);
    if (n >= 1 && n <= totalPages) goToPage(n);
    else if (pageInput) pageInput.value = currentPage;
  });

  document.getElementById("zoomIn")?.addEventListener("click", () => {
    if (htmlMode) {
      const view = document.getElementById("htmlReaderView");
      if (view) {
        const cur = parseFloat(view.dataset.zoom || "1");
        const next = Math.min(cur + 0.1, 1.6);
        view.dataset.zoom = String(next);
        view.style.fontSize = `${next}em`;
      }
      return;
    }
    scale = Math.min(+(scale + 0.15).toFixed(2), 3);
    fitMode = "custom";
    goToPage(currentPage);
  });
  document.getElementById("zoomOut")?.addEventListener("click", () => {
    if (htmlMode) {
      const view = document.getElementById("htmlReaderView");
      if (view) {
        const cur = parseFloat(view.dataset.zoom || "1");
        const next = Math.max(cur - 0.1, 0.8);
        view.dataset.zoom = String(next);
        view.style.fontSize = `${next}em`;
      }
      return;
    }
    scale = Math.max(+(scale - 0.15).toFixed(2), 0.4);
    fitMode = "custom";
    goToPage(currentPage);
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if ((e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") && currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
    if ((e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") && currentPage > 1) {
      goToPage(currentPage - 1);
    }
    if (e.key === "f" || e.key === "F") toggleFullscreen();
  });

  document.getElementById("saveProgress")?.addEventListener("click", () => {
    saveProgress(currentPage);
    const btn = document.getElementById("saveProgress");
    if (!btn) return;
    btn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => (btn.innerHTML = '<i class="fas fa-bookmark"></i>'), 1500);
  });

  document.getElementById("openAI")?.addEventListener("click", openAIModal);
  document.getElementById("generateSummary")?.addEventListener("click", openAIModal);
  document.getElementById("closeAiModal")?.addEventListener("click", () =>
    document.getElementById("aiModal")?.classList.remove("open"),
  );

  document.getElementById("saveGroqKey")?.addEventListener("click", () => {
    const input = document.getElementById("groqKeyInput");
    const key = (input?.value || "").trim();
    if (!key) return;
    try {
      localStorage.setItem(GROQ_KEY_STORAGE, key);
    } catch (_) {}
    openAIModal(true);
  });

  document.getElementById("openSidePanel")?.addEventListener("click", () => {
    document.getElementById("readerPanel")?.classList.toggle("open");
  });

  // Re-render on resize (debounced)
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (pdfDoc) renderPage(currentPage);
    }, 180);
  });
}

function saveProgress(page) {
  if (!bookKey) return;
  try {
    localStorage.setItem(bookKey + "_page", page);
  } catch (_) {}
}
function toggleFullscreen() {
  const layout = document.querySelector(".lv-reader-layout") || document.documentElement;
  const btn = document.getElementById("fullscreenBtn");

  if (!document.fullscreenElement) {
    (layout.requestFullscreen || layout.webkitRequestFullscreen)?.call(layout);
    if (btn) btn.innerHTML = '<i class="fas fa-compress"></i>';
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    if (btn) btn.innerHTML = '<i class="fas fa-expand"></i>';
  }
}

function updateProgress() {
  if (!totalPages) return;
  const pct = Math.round((currentPage / totalPages) * 100);
  const bar = document.getElementById("progressBar");
  const label = document.getElementById("progressLabel");
  if (bar) bar.style.width = pct + "%";
  if (label) label.textContent = `Página ${currentPage} de ${totalPages} (${pct}%)`;
}

document.addEventListener("fullscreenchange", () => {
  const panel = document.getElementById("readerPanel");
  const btn = document.getElementById("fullscreenBtn");
  if (document.fullscreenElement) {
    if (panel) panel.style.display = "none";
    if (btn) btn.innerHTML = '<i class="fas fa-compress"></i>';
  } else {
    if (panel) panel.style.display = "";
    if (btn) btn.innerHTML = '<i class="fas fa-expand"></i>';
  }
  setTimeout(() => {
    if (pdfDoc) renderPage(currentPage);
  }, 200);
});

// ---- Text selection ----
function setupTextSelection() {
  const tooltip = document.getElementById("highlightTooltip");
  const doHL = document.getElementById("doHighlight");
  const copyTx = document.getElementById("copyText");

  document.addEventListener("mouseup", (e) => {
    const sel = window.getSelection();
    const txt = sel?.toString().trim();
    if (!txt || !textLayer?.contains(e.target)) {
      if (tooltip) tooltip.style.display = "none";
      return;
    }
    if (tooltip) {
      tooltip.style.display = "flex";
      tooltip.style.top = e.pageY - 50 + "px";
      tooltip.style.left = e.pageX + "px";
    }
  });

  doHL?.addEventListener("click", () => {
    const txt = window.getSelection()?.toString().trim();
    if (txt) addHighlight(txt);
    if (tooltip) tooltip.style.display = "none";
    window.getSelection()?.removeAllRanges();
  });

  copyTx?.addEventListener("click", () => {
    const txt = window.getSelection()?.toString().trim();
    if (txt) navigator.clipboard?.writeText(txt).catch(() => {});
    if (tooltip) tooltip.style.display = "none";
    window.getSelection()?.removeAllRanges();
  });

  document.addEventListener("mousedown", (e) => {
    if (tooltip && !tooltip.contains(e.target)) tooltip.style.display = "none";
  });
}

function addHighlight(text) {
  const hl = {
    text,
    page: currentPage,
    date: new Date().toLocaleDateString("es"),
  };
  highlights.push(hl);
  saveHighlights();
  renderHighlightsList();
}
function saveHighlights() {
  if (!bookKey) return;
  try {
    localStorage.setItem(bookKey + "_highlights", JSON.stringify(highlights));
  } catch (_) {}
}
function loadHighlights() {
  if (!bookKey) return;
  try {
    const saved = localStorage.getItem(bookKey + "_highlights");
    if (saved) {
      highlights = JSON.parse(saved);
      renderHighlightsList();
    }
  } catch (_) {}
}
function renderHighlightsList() {
  const list = document.getElementById("highlightsList");
  if (!list) return;
  if (!highlights.length) {
    list.innerHTML =
      '<p class="text-muted small">Selecciona texto en el lector para marcarlo.</p>';
    return;
  }
  list.innerHTML = highlights
    .map(
      (h, i) => `
    <div class="lv-highlight-item" onclick="goToHighlightPage(${h.page})">
      <button class="lv-highlight-del" onclick="deleteHighlight(event,${i})"><i class="fas fa-times"></i></button>
      <small style="color:var(--gold-light)">Pág. ${h.page} · ${h.date}</small>
      <div style="margin-top:.3rem">"${h.text.slice(0, 100)}${h.text.length > 100 ? "…" : ""}"</div>
    </div>`,
    )
    .join("");
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

// ---- AI Summary (Groq) ----
// IMPORTANTE: la API key NUNCA debe hardcodearse en el código fuente.
// Se guarda solo en localStorage del usuario. En producción ideal: backend/proxy.
function getGroqKey() {
  try {
    return localStorage.getItem(GROQ_KEY_STORAGE) || "";
  } catch (_) {
    return "";
  }
}

async function openAIModal(forceGenerate = false) {
  const modal = document.getElementById("aiModal");
  if (!modal) return;
  modal.classList.add("open");

  const keySetup = modal.querySelector("#aiKeySetup");
  const loading = modal.querySelector("#aiLoading");
  const result = modal.querySelector("#aiResult");

  const apiKey = getGroqKey();
  if (!apiKey && !forceGenerate) {
    if (keySetup) keySetup.style.display = "block";
    if (loading) loading.style.display = "none";
    if (result) result.style.display = "none";
    return;
  }

  if (keySetup) keySetup.style.display = "none";
  if (loading) loading.style.display = "flex";
  if (result) result.style.display = "none";

  const bookTitle =
    currentBook?.title ||
    sessionStorage.getItem("lv_local_pdf_name") ||
    "este libro";
  const bookAuthor = currentBook?.author || "";
  const bookDesc = currentBook?.description || "";

  let pageText = "";
  try {
    if (htmlMode && htmlPages[currentPage - 1]) {
      const tmp = document.createElement("div");
      tmp.innerHTML = htmlPages[currentPage - 1];
      pageText = (tmp.textContent || "").replace(/\s+/g, " ").trim().slice(0, 1800);
    } else if (pdfDoc) {
      const page = await pdfDoc.getPage(currentPage);
      const tc = await page.getTextContent();
      pageText = tc.items.map((i) => i.str).join(" ").slice(0, 1800);
    }
  } catch (_) {}

  const prompt = `Eres un asistente literario experto. Proporciona un resumen detallado y análisis del libro:

Título: "${bookTitle}"
${bookAuthor ? `Autor: ${bookAuthor}` : ""}
${bookDesc ? `Descripción: ${bookDesc}` : ""}
${pageText ? `\nTexto de muestra de la página actual:\n"${pageText}"` : ""}

Incluye:
1. Resumen general (3-4 párrafos)
2. Temas principales
3. Por qué vale la pena leerlo
4. Lección o enseñanza principal

Responde en español de forma clara y atractiva. Usa formato markdown básico.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1200,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: "Sos un crítico literario y asistente de lectura en español. Respuestas claras, estructuradas y en markdown.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || `Error ${res.status}`;
      if (res.status === 401 || /invalid|auth/i.test(errMsg)) {
        try { localStorage.removeItem(GROQ_KEY_STORAGE); } catch (_) {}
        if (keySetup) keySetup.style.display = "block";
        if (loading) loading.style.display = "none";
        if (result) {
          result.style.display = "block";
          result.innerHTML = `<p style="color:#e88">API key inválida. Pegá una nueva de Groq.</p>`;
        }
        return;
      }
      throw new Error(errMsg);
    }

    const text =
      data?.choices?.[0]?.message?.content ||
      "No se pudo generar el resumen.";

    const aiPanel = document.getElementById("aiContent");
    if (aiPanel) {
      aiPanel.innerHTML = `<div style="font-size:1.3rem;color:rgba(255,255,255,.75);line-height:1.8">${formatAI(text)}</div>`;
    }

    if (loading) loading.style.display = "none";
    if (result) {
      result.innerHTML = formatAI(text);
      result.style.display = "block";
    }
  } catch (err) {
    console.error("Groq AI error:", err);
    if (loading) loading.style.display = "none";
    if (result) {
      result.innerHTML = `
        <div style="color:#888;text-align:center;padding:2rem">
          <i class="fas fa-exclamation-circle" style="font-size:3rem;color:#C9973A;display:block;margin-bottom:1rem"></i>
          <p>No se pudo conectar con Groq.</p>
          <p style="font-size:1.25rem;margin-top:.6rem;opacity:.7">${err.message || ""}</p>
          ${currentBook?.description ? `<p style="font-size:1.3rem;margin-top:1.4rem;text-align:left"><strong>Descripción del libro:</strong><br>${currentBook.description}</p>` : ""}
          <button class="lv-btn-outline mt-3" onclick="document.getElementById('aiKeySetup').style.display='block';this.parentElement.style.display='none'">
            Configurar API key
          </button>
        </div>`;
      result.style.display = "block";
    }
  }
}

function formatAI(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^#{1,3} (.+)$/gm, '<h4 style="color:var(--gold-light);margin:.8rem 0 .4rem">$1</h4>')
    .replace(/\n/g, "<br>");
}

// ---- Loading / Error ----
function showLoading(show) {
  const el = document.getElementById("readerLoading");
  if (el) el.style.display = show ? "flex" : "none";
}
function showError(msg = "No se pudo cargar el contenido.") {
  showLoading(false);
  const errDiv = document.getElementById("readerError");
  const pdfCon = document.getElementById("pdfContainer");
  if (pdfCon) pdfCon.style.display = "none";
  if (errDiv) {
    errDiv.style.display = "flex";
    const p = errDiv.querySelector("p.text-muted");
    if (p) p.textContent = msg;
  }
}
