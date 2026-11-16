/**
 * js/main.js
 * Navegación clásica responsive y utilidades editoriales globales
 */
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const siteNav = document.getElementById('site-nav');

  if (toggleBtn && siteNav) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = siteNav.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
    });

    // Cerrar menú al hacer clic en un enlace en móvil
    siteNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        siteNav.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Limpiar cualquier Service Worker antiguo de la versión anterior de Web App
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
  }
});


// Interactividad del Esquema de Las 5 Solas de la Reforma (nosotros.html)
document.addEventListener('DOMContentLoaded', () => {
  const solaButtons = document.querySelectorAll('.sola-tab-btn');
  const solaRef = document.getElementById('sola-ref');
  const solaTitle = document.getElementById('sola-title');
  const solaDesc = document.getElementById('sola-desc');
  const solaLink = document.getElementById('sola-link');

  if (!solaButtons.length || !solaTitle) return;

  const SOLAS_DATA = {
    scriptura: {
      ref: '2 Timoteo 3:16–17 · Hebreos 4:12',
      title: 'Sola Scriptura: La Suficiencia e Inerrancia de la Palabra',
      desc: 'La Escritura es la única autoridad infalible y suficiente para la fe y la vida de la Iglesia. Ninguna tradición humana, emoción mística ni superstición está por encima del texto revelado por Dios.',
      linkHref: 'estudio.html?id=escolta',
      linkText: '📖 Leer estudio relacionado: El Salmo 91 y el Fin de la Superstición →'
    },
    christus: {
      ref: 'Juan 14:6 · Hechos 4:12 · 1 Timoteo 2:5',
      title: 'Solus Christus: Cristo como Único Mediador y Sacrificio Perfecto',
      desc: 'La salvación se encuentra exclusivamente en la persona y obra consumada de Jesucristo. Ningún ritual externo ni ceremonia religiosa tiene poder salvífico fuera de nuestra unión con Él.',
      linkHref: 'estudio.html?id=bautismo',
      linkText: '📖 Leer estudio relacionado: El Bautismo Bíblico y la Unión con Cristo →'
    },
    gratia: {
      ref: 'Efesios 2:1–9 · Romanos 3:10–12 · Juan 6:44',
      title: 'Sola Gratia: Resurrección Unilateral del Pecador Muerto',
      desc: 'Nuestra salvación descansa enteramente en el favor inmerecido y soberano de Dios. El ser humano muerto en sus delitos no coopera para darse vida; Dios toma toda la iniciativa.',
      linkHref: 'estudio.html?id=gracia-soberana',
      linkText: '📖 Leer estudio relacionado: El Mito de «Yo Encontré a Dios» →'
    },
    fide: {
      ref: 'Romanos 3:23–28 · Romanos 5:1 · 2 Corintios 5:21',
      title: 'Sola Fide: El Gran Intercambio y la Justicia Imputada',
      desc: 'Somos declarados legalmente justos ante el tribunal de Dios únicamente por medio de la fe en Cristo, sin añadir obra ni mérito humano alguno. Nuestros pecados fueron cargados a Él y Su justicia a nosotros.',
      linkHref: 'estudio.html?id=deuda',
      linkText: '📖 Leer estudio relacionado: La Justificación y el Gran Intercambio →'
    },
    gloria: {
      ref: 'Romanos 11:36 · Mateo 6:1–18 · 1 Corintios 10:31',
      title: 'Soli Deo Gloria: El Fin del Teatro Religioso y la Vanagloria',
      desc: 'Debido a que Dios es el autor absoluto de nuestra redención, toda la gloria le pertenece solo a Él. Nuestra oración, ofrenda, ayuno y santidad se viven para Su mirada y no para el aplauso humano.',
      linkHref: 'estudio.html?id=aposento',
      linkText: '📖 Leer estudio relacionado: La Oración en el Aposento Secreto →'
    }
  };

  solaButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sola;
      const item = SOLAS_DATA[key];
      if (!item) return;

      solaButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      solaRef.textContent = item.ref;
      solaTitle.textContent = item.title;
      solaDesc.textContent = item.desc;
      solaLink.href = item.linkHref;
      solaLink.textContent = item.linkText;
    });
  });
});


// ==========================================================================
// SISTEMA DE DESBLOQUEO DE DESCARGAS PDF PARA BENEFACTORES (Ko-fi)
// ==========================================================================
(function () {
  const VALID_HASHES = new Set([
    'd19c084ce3b3e697e2ea77a8f7da37741a926bcf632951383e3aa2aa637a55ae',
    '5ce8a6ddec72870d6a68223721578b49c265693a736616a3d7d046de3ae82b4d',
    '09d3803af37b24e61602cb08250611db12d16a284c70801cc2dd9cd0a243c0ea',
    '0033e940e15009a87e071fc3b8333fa8f31e39e95bc5d8d31dccd0cfa5476fb2'
  ]);

  const STORAGE_KEY = 'cb_benefactor_unlocked_v1';
  const STORAGE_EMAIL = 'cb_benefactor_email_v1';

  async function sha256Hex(str) {
    const clean = (str || '').toUpperCase().replace(/[\s\-_]/g, '');
    const buf = new TextEncoder().encode(clean);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function validarClave(code, email) {
    const hex = await sha256Hex(code);
    if (VALID_HASHES.has(hex)) {
      localStorage.setItem(STORAGE_KEY, 'true');
      if (email) localStorage.setItem(STORAGE_EMAIL, email.trim());
      return true;
    }
    return false;
  }

  function estaDesbloqueado() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }

  window.CodiceBenefactor = {
    validarClave,
    estaDesbloqueado,
    obtenerEmail: () => localStorage.getItem(STORAGE_EMAIL) || ''
  };

  // Detectar desbloqueo automático por enlace de retorno de Ko-fi (?acceso=...)
  document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const accesoParam = params.get('acceso');
    if (accesoParam) {
      const ok = await validarClave(accesoParam, 'Donante Ko-fi');
      if (ok) {
        // Limpiar el parámetro de la barra de direcciones para que no se copie por accidente
        params.delete('acceso');
        const newQuery = params.toString();
        const cleanUrl = window.location.pathname + (newQuery ? `?${newQuery}` : '');
        window.history.replaceState({}, '', cleanUrl);

        const banner = document.createElement('div');
        banner.style.cssText =
          'background:#9A7B3E;color:#fff;text-align:center;padding:0.75rem 1rem;font-size:0.88rem;font-weight:600;';
        banner.textContent =
          '✦ ¡Gracias por apoyar a Códice Bíblico! La descarga directa de todos los estudios en PDF ha quedado habilitada en tu navegador.';
        document.body.prepend(banner);
      }
    }
  });
})();
