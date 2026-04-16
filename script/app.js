/* ============================================================
   app.js – LibroVivo
   Rutas: index.html en raíz, pages/ para catálogo/lector,
          scripts/ para JS
   ============================================================ */

const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const getCatLabel = id => CATEGORIES.find(c => c.id === id)?.label || id;
const getCatIcon  = id => CATEGORIES.find(c => c.id === id)?.icon  || 'fas fa-book';

// Detectar si estamos dentro de pages/ o en raíz
const inPages = window.location.pathname.includes('/pages/');
const ROOT    = inPages ? '../' : './';
const PAGES   = inPages ? './'  : './pages/';

// Fallback cover SVG inline (no dependencia externa)
function coverFallback(title) {
  const colors = ['%236B1E2B','%234A1942','%231A3A4A','%232A4A1A','%234A3A1A'];
  const c = colors[title.charCodeAt(0) % colors.length];
  const initial = encodeURIComponent(title[0]?.toUpperCase() || '?');
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Crect width='300' height='450' fill='${c}'/%3E%3Crect x='15' y='15' width='270' height='420' fill='none' stroke='rgba(255,255,255,.15)' stroke-width='1'/%3E%3Ccircle cx='150' cy='200' r='60' fill='rgba(255,255,255,.07)'/%3E%3Ctext x='150' y='215' text-anchor='middle' font-family='Georgia%2C serif' font-size='56' font-weight='bold' fill='rgba(255,255,255,.5)'%3E${initial}%3C/text%3E%3C/svg%3E`;
}

function bookCard(book, size = 'col-md-4 col-sm-6') {
  const year = book.year < 0 ? Math.abs(book.year) + ' a.C.' : book.year;
  return `
  <div class="${size} lv-book-col">
    <div class="lv-book-card" onclick="goReader('${book.slug}')">
      <div class="lv-book-cover-wrap">
        <img src="${book.cover}" alt="${book.title}" class="lv-book-cover" loading="lazy"
             onerror="this.src='${coverFallback(book.title)}'">
        <div class="lv-book-overlay">
          <button class="lv-read-btn">
            ${book.demoOnly ? '<i class="fas fa-info-circle me-2"></i>Ver info' : '<i class="fas fa-book-open me-2"></i>Leer ahora'}
          </button>
        </div>
        ${book.new      ? '<span class="lv-badge-new">Nuevo</span>'          : ''}
        ${book.featured ? '<span class="lv-badge-featured">Destacado</span>' : ''}
        ${book.demoOnly ? '<span class="lv-badge-demo">Próx.</span>'         : ''}
      </div>
      <div class="lv-book-info">
        <div class="lv-book-category"><i class="${getCatIcon(book.category)} me-1"></i>${getCatLabel(book.category)}</div>
        <div class="lv-book-title">${book.title}</div>
        <div class="lv-book-author">${book.author}</div>
        <div class="d-flex justify-content-between align-items-center mt-auto pt-1">
          <span class="lv-book-year"><i class="fas fa-calendar-alt me-1"></i>${year}</span>
          ${book.pages ? `<span class="lv-book-pages"><i class="fas fa-file-alt me-1"></i>${book.pages} p.</span>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function goReader(slug) {
  window.location.href = `${PAGES}lector.html?book=${slug}`;
}

// ---- NAVBAR SCROLL ----
window.addEventListener('scroll', () => {
  const nav = qs('#mainNav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 50);
});

// ---- GLOBAL SEARCH ----
function initSearch() {
  const input    = qs('#globalSearch');
  const dropdown = qs('#searchResults');
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { dropdown.classList.remove('open'); return; }
    const results = BOOKS.filter(b =>
      b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
    ).slice(0, 5);
    if (!results.length) { dropdown.classList.remove('open'); return; }
    dropdown.innerHTML = results.map(b => `
      <div class="lv-search-item" onclick="goReader('${b.slug}')">
        <img src="${b.cover}" alt="${b.title}" onerror="this.src='${coverFallback(b.title)}'">
        <div class="lv-search-item-meta">
          <h6>${b.title}</h6>
          <small>${b.author} · ${b.year < 0 ? Math.abs(b.year)+' a.C.' : b.year}</small>
        </div>
      </div>`).join('');
    dropdown.classList.add('open');
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target))
      dropdown.classList.remove('open');
  });
}

// ---- DONATE ----
function openDonate()  { qs('#donateModal')?.classList.add('open'); }
function closeDonate() { qs('#donateModal')?.classList.remove('open'); }
function donate(amount) {
  qsa('.lv-donate-amount').forEach(b => b.classList.remove('selected'));
  event.target.closest('.lv-donate-amount').classList.add('selected');
  const paypalBtn   = qs('#paypalBtn');
  const paypalEmail = 'TU_PAYPAL_EMAIL@gmail.com';
  paypalBtn.href    = `https://www.paypal.com/donate/?business=${encodeURIComponent(paypalEmail)}&amount=${amount}&currency_code=USD&item_name=Donacion+LibroVivo`;
  paypalBtn.style.display = 'flex';
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeDonate();
    qs('#aiModal')?.classList.remove('open');
  }
});
document.addEventListener('click', e => {
  const modal = qs('#donateModal');
  if (modal && e.target === modal) closeDonate();
});

// ============================================================
//  HOME PAGE
// ============================================================
function initHome() {
  if (!qs('#heroBooks')) return;

  qs('#statBooks').textContent = BOOKS.length;

  // Hero books flotantes con animación
  const heroContainer = qs('#heroBooks');
  const heroSample = BOOKS.filter(b => b.featured).slice(0, 4);
  heroSample.forEach((b, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'lv-hero-book-wrap';
    wrap.style.animationDelay = `${i * 0.2}s`;

    const img = document.createElement('img');
    img.src    = b.cover;
    img.alt    = b.title;
    img.className = 'lv-hero-book';
    img.onerror   = () => img.src = coverFallback(b.title);
    img.onclick   = () => goReader(b.slug);
    img.title     = b.title;

    wrap.appendChild(img);
    heroContainer.appendChild(wrap);
  });

  // Categorías grid
  const grid = qs('#categoriesGrid');
  if (grid) {
    CATEGORIES.forEach(cat => {
      const count = BOOKS.filter(b => b.category === cat.id).length;
      const col   = document.createElement('div');
      col.className = 'col-6 col-md-3';
      col.innerHTML = `
        <div class="lv-category-card" onclick="window.location.href='${PAGES}catalogo.html?cat=${cat.id}'">
          <i class="${cat.icon} lv-category-icon"></i>
          <div class="lv-category-name">${cat.label}</div>
          <div class="lv-category-count">${count} libro${count !== 1 ? 's' : ''}</div>
        </div>`;
      grid.appendChild(col);
    });
  }

  // Swiper novedades
  const newWrapper = qs('#newBooksWrapper');
  if (newWrapper) {
    BOOKS.filter(b => b.new).forEach(b => {
      const slide = document.createElement('div');
      slide.className = 'swiper-slide';
      slide.innerHTML  = bookCard(b, '');
      newWrapper.appendChild(slide);
    });
    new Swiper('#newSwiper', {
      spaceBetween: 20,
      grabCursor: true,
      loop: true,
      autoplay: { delay: 4000, disableOnInteraction: false },
      pagination: { el: '.lv-swiper-pagination', clickable: true },
      breakpoints: {
        0:    { slidesPerView: 1 },
        480:  { slidesPerView: 2 },
        768:  { slidesPerView: 3 },
        1200: { slidesPerView: 4 },
      }
    });
  }

  // Swiper destacados
  const featWrapper = qs('#featuredBooksWrapper');
  if (featWrapper) {
    BOOKS.filter(b => b.featured).forEach(b => {
      const slide = document.createElement('div');
      slide.className = 'swiper-slide';
      slide.innerHTML  = bookCard(b, '');
      featWrapper.appendChild(slide);
    });
    new Swiper('#featuredSwiper', {
      spaceBetween: 20,
      grabCursor: true,
      loop: true,
      navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
      autoplay: { delay: 5000, disableOnInteraction: false },
      breakpoints: {
        0:    { slidesPerView: 1 },
        480:  { slidesPerView: 2 },
        768:  { slidesPerView: 3 },
        1200: { slidesPerView: 4 },
      }
    });
  }

  // Footer categorías
  const footerCats = qs('#footerCategories');
  if (footerCats) {
    CATEGORIES.slice(0, 5).forEach(cat => {
      footerCats.innerHTML += `<li><a href="${PAGES}catalogo.html?cat=${cat.id}">${cat.label}</a></li>`;
    });
  }

  initUpload();
}

function initUpload() {
  const box   = qs('#uploadBox');
  const input = qs('#pdfFileInput');
  if (!box || !input) return;

  ['dragover','dragenter'].forEach(ev =>
    box.addEventListener(ev, e => { e.preventDefault(); box.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(ev =>
    box.addEventListener(ev, () => box.classList.remove('dragover')));

  box.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') openLocalPDF(file);
    else showUploadError('Por favor sube un archivo PDF válido.');
  });

  input.addEventListener('change', () => {
    if (input.files[0]) openLocalPDF(input.files[0]);
  });
}

function showUploadError(msg) {
  const box = qs('#uploadBox');
  if (!box) return;
  const err = document.createElement('p');
  err.style.cssText = 'color:#C9973A;font-size:1.4rem;margin-top:1rem';
  err.textContent = msg;
  box.appendChild(err);
  setTimeout(() => err.remove(), 3000);
}

function openLocalPDF(file) {
  if (file.size > 50 * 1024 * 1024) {
    showUploadError('Archivo demasiado grande (máx. 50 MB).');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      sessionStorage.setItem('lv_local_pdf', e.target.result);
      sessionStorage.setItem('lv_local_pdf_name', file.name.replace('.pdf',''));
      window.location.href = `${PAGES}lector.html?local=1`;
    } catch(err) {
      // sessionStorage quota exceeded – use object URL instead
      const url = URL.createObjectURL(file);
      sessionStorage.setItem('lv_local_pdf_url', url);
      sessionStorage.setItem('lv_local_pdf_name', file.name.replace('.pdf',''));
      sessionStorage.setItem('lv_local_pdf_blob', '1');
      window.location.href = `${PAGES}lector.html?local=1`;
    }
  };
  reader.readAsDataURL(file);
}

// ============================================================
//  CATÁLOGO
// ============================================================
function initCatalog() {
  const grid = qs('#booksGrid');
  if (!grid) return;

  let activeCategory = '';
  let activeYear     = '';
  let activeLang     = '';
  let featOnly       = false;
  let newOnly        = false;
  let searchQuery    = '';
  let sortMode       = 'title';

  const params = new URLSearchParams(window.location.search);
  if (params.get('cat'))                   activeCategory = params.get('cat');
  if (params.get('filter') === 'new')      newOnly        = true;
  if (params.get('filter') === 'featured') featOnly       = true;

  // Sidebar categorías
  const catContainer = qs('#filterCategories');
  catContainer.innerHTML = `
    <button class="lv-filter-cat-btn ${!activeCategory ? 'active' : ''}" data-cat="">
      <i class="fas fa-th me-1"></i> Todas
    </button>`;
  CATEGORIES.forEach(cat => {
    catContainer.innerHTML += `
      <button class="lv-filter-cat-btn ${activeCategory === cat.id ? 'active' : ''}" data-cat="${cat.id}">
        <i class="${cat.icon} me-1"></i>${cat.label}
      </button>`;
  });

  if (newOnly)  { const el = qs('#filterNew');      if (el) el.checked = true; }
  if (featOnly) { const el = qs('#filterFeatured'); if (el) el.checked = true; }

  function render() {
    let books = [...BOOKS];
    if (activeCategory) books = books.filter(b => b.category === activeCategory);
    if (activeYear) {
      books = books.filter(b => {
        if (activeYear === 'ancient')      return b.year < 1800;
        if (activeYear === 'classic')      return b.year >= 1800 && b.year < 1950;
        if (activeYear === 'modern')       return b.year >= 1950 && b.year < 2000;
        if (activeYear === 'contemporary') return b.year >= 2000;
        return true;
      });
    }
    if (activeLang)  books = books.filter(b => b.language === activeLang);
    if (featOnly)    books = books.filter(b => b.featured);
    if (newOnly)     books = books.filter(b => b.new);
    if (searchQuery) books = books.filter(b =>
      b.title.toLowerCase().includes(searchQuery) ||
      b.author.toLowerCase().includes(searchQuery));

    if (sortMode === 'title')     books.sort((a, b) => a.title.localeCompare(b.title));
    if (sortMode === 'year-desc') books.sort((a, b) => b.year - a.year);
    if (sortMode === 'year-asc')  books.sort((a, b) => a.year - b.year);

    grid.innerHTML = books.map(b => bookCard(b, 'col-md-4 col-xl-3 col-sm-6')).join('');

    const empty = qs('#emptyState');
    const count = qs('#resultsCount');
    if (empty) empty.style.display = books.length ? 'none' : 'block';
    if (count) count.innerHTML = `Mostrando <strong>${books.length}</strong> libro${books.length !== 1 ? 's' : ''}`;
  }

  catContainer.addEventListener('click', e => {
    const btn = e.target.closest('.lv-filter-cat-btn');
    if (!btn) return;
    qsa('.lv-filter-cat-btn', catContainer).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.dataset.cat;
    render();
  });

  qs('#filterYear')?.addEventListener('change', e => { activeYear = e.target.value; render(); });
  qsa('input[name="lang"]').forEach(r => r.addEventListener('change', e => { activeLang = e.target.value; render(); }));
  qs('#filterFeatured')?.addEventListener('change', e => { featOnly = e.target.checked; render(); });
  qs('#filterNew')?.addEventListener('change',      e => { newOnly  = e.target.checked; render(); });
  qs('#sidebarSearch')?.addEventListener('input',   e => { searchQuery = e.target.value.trim().toLowerCase(); render(); });
  qs('#sortSelect')?.addEventListener('change',     e => { sortMode = e.target.value; render(); });

  const clearAll = () => {
    activeCategory = ''; activeYear = ''; activeLang = '';
    featOnly = false; newOnly = false; searchQuery = '';
    qsa('.lv-filter-cat-btn').forEach(b => b.classList.remove('active'));
    qs('[data-cat=""]')?.classList.add('active');
    if (qs('#filterYear'))     qs('#filterYear').value = '';
    if (qs('#filterNew'))      qs('#filterNew').checked = false;
    if (qs('#filterFeatured')) qs('#filterFeatured').checked = false;
    if (qs('#sidebarSearch'))  qs('#sidebarSearch').value = '';
    const allLang = qsa('input[name="lang"]');
    if (allLang[0]) allLang[0].checked = true;
    render();
  };
  qs('#clearFilters')?.addEventListener('click', clearAll);
  qs('#clearFilters2')?.addEventListener('click', clearAll);

  qs('#openSidebar')?.addEventListener('click', () => {
    qs('#filterSidebar')?.classList.add('open');
    qs('#sidebarOverlay')?.classList.add('open');
  });
  const closeSB = () => {
    qs('#filterSidebar')?.classList.remove('open');
    qs('#sidebarOverlay')?.classList.remove('open');
  };
  qs('#closeSidebar')?.addEventListener('click', closeSB);
  qs('#sidebarOverlay')?.addEventListener('click', closeSB);

  render();
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initSearch();
  initHome();
  initCatalog();
});
