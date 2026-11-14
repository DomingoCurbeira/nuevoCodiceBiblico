/**
 * js/catalogo.js
 * Renderiza el catálogo de estudios teológicos en formato Grid Editorial
 */
document.addEventListener('DOMContentLoaded', async () => {
  const gridEl = document.getElementById('studies-grid');
  const filtersEl = document.getElementById('filter-tabs');
  const searchInput = document.getElementById('catalog-search');
  const countEl = document.getElementById('studies-count');

  if (!gridEl) return;

  let estudios = [];
  let serieActiva = 'Todos';
  let busqueda = '';

  const normalizar = (str) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

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
    const series = ['Todos', ...new Set(estudios.map(e => e.serie).filter(Boolean))];
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
        filtersEl.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderizarCatalogo();
      });
    });

    // Conectar las tarjetas de Rutas Doctrinales con el filtro del catálogo
    document.querySelectorAll('[data-select-serie]').forEach(card => {
      card.addEventListener('click', () => {
        const targetSerie = card.dataset.selectSerie;
        serieActiva = targetSerie;
        filtersEl.querySelectorAll('.filter-tab').forEach(b => {
          b.classList.toggle('active', b.dataset.serie === targetSerie);
        });
        renderizarCatalogo();
        gridEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      busqueda = e.target.value.trim();
      renderizarCatalogo();
    });
  }

  function renderizarCatalogo() {
    const q = normalizar(busqueda);

    const filtrados = estudios.filter(item => {
      const coincideSerie = serieActiva === 'Todos' || item.serie === serieActiva;
      if (!coincideSerie) return false;
      if (!q) return true;

      const texto = normalizar(
        `${item.titulo} ${item.subtitulo} ${item.referencia} ${item.categoria} ${item.serie}`
      );
      return texto.includes(q);
    });

    if (countEl) {
      countEl.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'estudio disponible' : 'estudios disponibles'}`;
    }

    if (filtrados.length === 0) {
      gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
          <p class="serif-title" style="font-size: 1.4rem; margin-bottom: 0.4rem;">Sin resultados para tu búsqueda</p>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Intenta con otro término doctrinal o selecciona «Todos» en las categorías.</p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = filtrados
      .map(
        estudio => `
        <article class="study-card">
          <a href="estudio.html?id=${encodeURIComponent(estudio.id)}" class="study-cover-wrap" aria-label="Leer ${estudio.titulo}">
            <img src="${estudio.portada}" alt="Portada de ${estudio.titulo}" class="study-cover-img" loading="lazy">
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
              <span>Lectura en línea · PDF</span>
              <a href="estudio.html?id=${encodeURIComponent(estudio.id)}" class="study-read-link">
                Leer estudio
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
            </div>
          </div>
        </article>
      `
      )
      .join('');
  }
});
