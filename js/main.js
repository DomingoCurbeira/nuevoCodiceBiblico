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
