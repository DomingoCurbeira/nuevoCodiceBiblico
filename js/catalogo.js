/**
 * js/catalogo.js
 * Renderiza el catálogo de estudios teológicos en formato Grid Editorial.
 * En «Todos» muestra los estudios más recientes primero; al filtrar una serie,
 * ordena estrictamente por Episodio (1, 2, 3...) con Paginador Numérico de 12 estudios (4 filas).
 */
document.addEventListener('DOMContentLoaded', async () => {
  const gridEl = document.getElementById('studies-grid');
  const filtersEl = document.getElementById('filter-tabs');
  const searchInput = document.getElementById('catalog-search');
  const countEl = document.getElementById('studies-count');
  const paginationEl = document.getElementById('catalog-pagination');

  if (!gridEl) return;

  const ITEMS_PER_PAGE = 12; // 4 filas de 3 columnas
  const READ_STORAGE_KEY = 'codice_estudios_leidos';
  let estudios = [];
  let serieActiva = 'Todos';
  let busqueda = '';
  let paginaActual = 1;

  function obtenerEstudiosLeidos() {
    try {
      const raw = localStorage.getItem(READ_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  const leidosSet = obtenerEstudiosLeidos();

  const ORDEN_SERIES = [
    'Cristo en las Sombras',
    'El Sermón del Monte',
    'Trilogía de la Salvación',
    'La Gracia Soberana',
    'Teología Reformada'
  ];

  const normalizar = (str) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  function obtenerNumeroEpisodio(edicionStr) {
    const limpio = normalizar(edicionStr);
    if (/\b(introduccion|prologo)\b/.test(limpio)) return 0;
    if (/\b(conclusion|epilogo)\b/.test(limpio)) return 9998;
    const match = String(edicionStr || '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 999;
  }

  function ordenarEstudios(lista) {
    // En la vista «Todos», conservar el orden cronológico inverso de publicación (más recientes primero)
    if (serieActiva === 'Todos') {
      return [...lista];
    }

    // Dentro de una serie específica, ordenar estrictamente del Episodio 1 al último
    return [...lista].sort((a, b) => {
      const epA = obtenerNumeroEpisodio(a.edicion);
      const epB = obtenerNumeroEpisodio(b.edicion);
      if (epA !== epB) return epA - epB;

      return (a.titulo || '').localeCompare(b.titulo || '', 'es');
    });
  }

  try {
    const res = await fetch('data/estudios.json');
    if (!res.ok) throw new Error('No se pudo cargar el catálogo de estudios');
    estudios = await res.json();
    inicializarFiltros();
    renderizarCatalogo();
  } catch (err) {
    console.error(err);
    gridEl.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
        No se pudieron cargar los estudios en este momento.
      </div>
    `;
  }

  function inicializarFiltros() {
    if (!filtersEl) return;
    const seriesPresentes = [...new Set(estudios.map(e => e.serie).filter(Boolean))];
    seriesPresentes.sort((a, b) => {
      const ia = ORDEN_SERIES.indexOf(a);
      const ib = ORDEN_SERIES.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    const series = ['Todos', ...seriesPresentes];
    filtersEl.innerHTML = series
      .map(
        serie => `
        <button type="button" class="filter-tab ${serie === serieActiva ? 'active' : ''}" data-serie="${serie}">
          ${serie}
        </button>
      `
      )
      .join('');

    filtersEl.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        serieActiva = btn.dataset.serie;
        paginaActual = 1;
        filtersEl.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderizarCatalogo();
      });
    });

    document.querySelectorAll('[data-select-serie]').forEach(card => {
      const targetSerie = card.dataset.selectSerie;
      const deSerie = estudios.filter(e => e.serie === targetSerie);
      const leidosEnSerie = deSerie.filter(e => leidosSet.has(e.id)).length;
      if (leidosEnSerie > 0 && deSerie.length > 0) {
        const pill = document.createElement('span');
        pill.className = 'path-progress-pill';
        pill.textContent = `✓ ${leidosEnSerie}/${deSerie.length} leídos`;
        const head = card.querySelector('.path-card-head');
        if (head) {
          head.appendChild(pill);
        } else {
          const eyebrow = card.querySelector('.eyebrow');
          if (eyebrow) {
            const wrap = document.createElement('div');
            wrap.className = 'path-card-head';
            eyebrow.parentNode.insertBefore(wrap, eyebrow);
            wrap.appendChild(eyebrow);
            wrap.appendChild(pill);
          }
        }
      }

      card.addEventListener('click', () => {
        serieActiva = targetSerie;
        paginaActual = 1;
        filtersEl.querySelectorAll('.filter-tab').forEach(b => {
          b.classList.toggle('active', b.dataset.serie === targetSerie);
        });
        renderizarCatalogo();
        const controls = document.querySelector('.catalog-controls') || gridEl;
        controls.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      busqueda = e.target.value.trim();
      paginaActual = 1;
      renderizarCatalogo();
    });
  }

  function generarRangoPaginas(actual, total) {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages = [1];
    if (actual > 3) pages.push('...');
    const start = Math.max(2, actual - 1);
    const end = Math.min(total - 1, actual + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (actual < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  function renderizarPaginador(totalItems) {
    if (!paginationEl) return;
    const totalPaginas = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (totalPaginas <= 1) {
      paginationEl.style.display = 'none';
      paginationEl.innerHTML = '';
      return;
    }

    paginationEl.style.display = 'flex';
    const rango = generarRangoPaginas(paginaActual, totalPaginas);

    const botonesNumeros = rango
      .map(p => {
        if (p === '...') {
          return `<span class="page-ellipsis" aria-hidden="true">…</span>`;
        }
        return `
          <button
            type="button"
            class="page-btn ${p === paginaActual ? 'active' : ''}"
            data-page="${p}"
            aria-label="Página ${p}"
            ${p === paginaActual ? 'aria-current="page"' : ''}
          >
            ${p}
          </button>
        `;
      })
      .join('');

    paginationEl.innerHTML = `
      <button type="button" class="page-btn" data-page="${paginaActual - 1}" ${paginaActual <= 1 ? 'disabled' : ''}>
        ← Anterior
      </button>
      ${botonesNumeros}
      <button type="button" class="page-btn" data-page="${paginaActual + 1}" ${paginaActual >= totalPaginas ? 'disabled' : ''}>
        Siguiente →
      </button>
    `;

    paginationEl.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetPage = parseInt(btn.dataset.page, 10);
        if (!targetPage || targetPage === paginaActual || targetPage < 1 || targetPage > totalPaginas) return;
        paginaActual = targetPage;
        renderizarCatalogo();
        const controls = document.querySelector('.catalog-controls') || gridEl;
        controls.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function renderizarCatalogo() {
    const q = normalizar(busqueda);

    const filtrados = estudios.filter(item => {
      const coincideSerie = serieActiva === 'Todos' || item.serie === serieActiva;
      if (!coincideSerie) return false;
      if (!q) return true;

      const texto = normalizar(
        `${item.titulo} ${item.subtitulo} ${item.referencia} ${item.categoria} ${item.serie} ${item.edicion}`
      );
      return texto.includes(q);
    });

    const ordenados = ordenarEstudios(filtrados);
    const total = ordenados.length;
    const totalPaginas = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;

    const inicio = (paginaActual - 1) * ITEMS_PER_PAGE;
    const fin = Math.min(inicio + ITEMS_PER_PAGE, total);
    const paginados = ordenados.slice(inicio, fin);

    const leidosEnVista = ordenados.filter(item => leidosSet.has(item.id)).length;
    const progresoTexto =
      leidosEnVista > 0 ? ` · ✓ ${leidosEnVista} de ${total} leídos` : '';

    if (countEl) {
      const ordenLabel = serieActiva === 'Todos' ? 'Más recientes primero' : 'Ordenados por episodio';
      if (total === 0) {
        countEl.textContent = '0 estudios disponibles';
      } else if (total <= ITEMS_PER_PAGE) {
        countEl.textContent = `${total} ${total === 1 ? 'estudio disponible' : 'estudios disponibles'} · ${ordenLabel}${progresoTexto}`;
      } else {
        countEl.textContent = `Mostrando ${inicio + 1}–${fin} de ${total} estudios · ${ordenLabel} (Página ${paginaActual} de ${totalPaginas})${progresoTexto}`;
      }
    }

    if (total === 0) {
      gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
          <p class="serif-title" style="font-size: 1.4rem; margin-bottom: 0.4rem;">Sin resultados para tu búsqueda</p>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Intenta con otro término doctrinal o selecciona «Todos» en las categorías.</p>
        </div>
      `;
      renderizarPaginador(0);
      return;
    }

    gridEl.innerHTML = paginados
      .map(estudio => {
        const esLeido = leidosSet.has(estudio.id);
        return `
        <article class="study-card${esLeido ? ' is-read' : ''}">
          <a href="estudio.html?id=${encodeURIComponent(estudio.id)}" class="study-cover-wrap" aria-label="Leer ${estudio.titulo}">
            <img src="${estudio.portada}" alt="Portada de ${estudio.titulo}" class="study-cover-img" loading="lazy">
            ${esLeido ? '<span class="study-read-badge" title="Ya leíste este estudio">✓ Leído</span>' : ''}
            <span class="study-edition-badge">${estudio.edicion || 'Estudio'}</span>
          </a>
          <div class="study-body">
            <div class="study-series">${estudio.serie}</div>
            <h2 class="study-title">
              <a href="estudio.html?id=${encodeURIComponent(estudio.id)}">${estudio.titulo}</a>
            </h2>
            <div class="study-scripture">${estudio.referencia}</div>
            <p class="study-excerpt">${estudio.subtitulo}</p>
            <div class="study-footer">
              <span class="${esLeido ? 'study-footer-read' : ''}">${esLeido ? '✓ Estudio leído' : 'Lectura en línea · PDF'}</span>
              <a href="estudio.html?id=${encodeURIComponent(estudio.id)}" class="study-read-link">
                ${esLeido ? 'Volver a leer' : 'Leer estudio'}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
            </div>
          </div>
        </article>
      `;
      })
      .join('');

    renderizarPaginador(total);
  }
});
