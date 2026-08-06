/* FSTBooks – bilingual ES / EN */
const I18N = {
  es: {
    'nav.home': 'Inicio',
    'nav.catalog': 'Catálogo',
    'nav.donate': 'Donar',
    'hero.badge': 'Biblioteca 100% gratuita',
    'hero.title': 'El saber no<br><em>tiene precio</em>',
    'hero.sub': 'Libros clásicos en dominio público para leer en tu navegador. Guardá tu progreso y usá IA para entender mejor cada obra.',
    'hero.explore': 'Explorar Catálogo',
    'hero.upload': 'Mi PDF',
    'projects.title': 'Más de <em>FSTail</em>',
    'projects.sub': 'Otros proyectos del ecosistema',
    'cta.title': 'Soluciones digitales hechas para <em>crecer</em>',
    'cta.sub': 'Landing pages, sitios completos y mantenimiento. Código limpio, diseño preciso y resultados que duran.',
    'cta.services': 'Ver servicios',
    'cta.contact': '¿Querés un sitio así? Hablemos',
    'cta.contact2': 'Contactar',
    'new.title': 'Recién <em>Agregados</em>',
    'feat.title': 'Libros <em>Destacados</em>',
    'cat.title': 'Explorar por <em>Categoría</em>',
    'upload.title': 'Carga y lee<br><em>tu archivo</em>',
  },
  en: {
    'nav.home': 'Home',
    'nav.catalog': 'Catalog',
    'nav.donate': 'Donate',
    'hero.badge': '100% free library',
    'hero.title': 'Knowledge has<br><em>no price</em>',
    'hero.sub': 'Public-domain classics to read in your browser. Save progress and use AI to understand each work better.',
    'hero.explore': 'Browse Catalog',
    'hero.upload': 'My PDF',
    'projects.title': 'More from <em>FSTail</em>',
    'projects.sub': 'Other projects in the ecosystem',
    'cta.title': 'Digital solutions built to <em>grow</em>',
    'cta.sub': 'Landing pages, full websites and maintenance. Clean code, precise design, results that last.',
    'cta.services': 'See services',
    'cta.contact': 'Want a site like this? Let’s talk',
    'cta.contact2': 'Contact',
    'new.title': 'Just <em>Added</em>',
    'feat.title': 'Featured <em>Books</em>',
    'cat.title': 'Browse by <em>Category</em>',
    'upload.title': 'Upload and read<br><em>your file</em>',
  },
};

function getLang() {
  try {
    const saved = localStorage.getItem('lv_lang');
    if (saved) return saved;
    return (navigator.language || 'es').startsWith('en') ? 'en' : 'es';
  } catch (_) {
    return 'es';
  }
}

function setLang(lang) {
  try { localStorage.setItem('lv_lang', lang); } catch (_) {}
  document.documentElement.lang = lang;
  const dict = I18N[lang] || I18N.es;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] != null) el.innerHTML = dict[key];
  });
  const btn = document.getElementById('langToggle');
  if (btn) btn.textContent = lang === 'es' ? 'EN' : 'ES';
}

document.addEventListener('DOMContentLoaded', () => {
  const lang = (() => {
    try { return localStorage.getItem('lv_lang') || 'es'; } catch (_) { return 'es'; }
  })();
  setLang(lang);
  document.getElementById('langToggle')?.addEventListener('click', () => {
    const next = (document.documentElement.lang === 'en') ? 'es' : 'en';
    setLang(next);
  });
});
