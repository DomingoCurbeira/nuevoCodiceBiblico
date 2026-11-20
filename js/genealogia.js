/**
 * js/genealogia.js
 * Genealogía Interactiva de Jesucristo (Mateo 1 y Lucas 3).
 * Permite alternar entre Mateo 1, Lucas 3 y la Vista Comparativa, filtrar personajes clave
 * o las 5 mujeres de Mateo, y abrir fichas biográfico-teológicas conectadas con Etymos y Panorama.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const viewButtons = document.querySelectorAll('#genealogy-view-switcher .mode-btn');
  const introBanner = document.getElementById('genealogy-intro-banner');
  const controlsWrap = document.getElementById('genealogy-controls');
  const filtersWrap = document.getElementById('genealogy-filters');
  const womenFilterBtn = document.getElementById('filter-women-btn');
  const searchInput = document.getElementById('genealogy-search');
  const timelineView = document.getElementById('genealogy-timeline-view');
  const compareView = document.getElementById('genealogy-compare-view');
  const modalBackdrop = document.getElementById('genealogy-modal-backdrop');
  const modalContent = document.getElementById('genealogy-modal-content');

  if (!timelineView || !compareView) return;

  let data = null;
  let activeView = 'mateo'; // 'mateo' | 'lucas' | 'comparativa'
  let activeFilter = 'todos'; // 'todos' | 'clave' | 'mujeres'
  let searchQuery = '';

  const normalizar = (str) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const escapeHtml = (str) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  try {
    const res = await fetch('data/genealogia.json');
    if (!res.ok) throw new Error('Error cargando data/genealogia.json');
    data = await res.json();
    render();

    const params = new URLSearchParams(window.location.search);
    const vistaParam = params.get('vista');
    if (vistaParam && ['mateo', 'lucas', 'comparativa'].includes(vistaParam)) {
      cambiarVista(vistaParam);
    }
    const personajeParam = params.get('personaje');
    if (personajeParam && data.fichas[personajeParam]) {
      abrirFicha(personajeParam);
    }
  } catch (err) {
    console.error(err);
    timelineView.innerHTML = `<p style="padding:2rem; color:var(--text-muted);">No se pudo cargar la genealogía en este momento.</p>`;
  }

  function cambiarVista(vista) {
    activeView = vista;
    viewButtons.forEach(b => {
      const isAct = b.dataset.view === activeView;
      b.classList.toggle('active', isAct);
      b.setAttribute('aria-selected', String(isAct));
    });

    if (activeView !== 'mateo' && activeFilter === 'mujeres') {
      activeFilter = 'todos';
      if (filtersWrap) {
        filtersWrap.querySelectorAll('.filter-tab').forEach(b => {
          b.classList.toggle('active', b.dataset.filter === 'todos');
        });
      }
    }
    render();
  }

  viewButtons.forEach(btn => {
    btn.addEventListener('click', () => cambiarVista(btn.dataset.view));
  });

  if (filtersWrap) {
    filtersWrap.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        filtersWrap.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render();
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      render();
    });
  }

  function cerrarModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
    const url = new URL(window.location.href);
    if (url.searchParams.has('personaje')) {
      url.searchParams.delete('personaje');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) cerrarModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) cerrarModal();
    });
  }

  function render() {
    if (!data) return;

    if (activeView === 'comparativa') {
      if (controlsWrap) controlsWrap.style.display = 'none';
      timelineView.style.display = 'none';
      compareView.style.display = 'block';
      renderComparativa();
      return;
    }

    if (controlsWrap) controlsWrap.style.display = 'flex';
    if (womenFilterBtn) {
      womenFilterBtn.style.display = activeView === 'mateo' ? 'inline-flex' : 'none';
    }
    compareView.style.display = 'none';
    timelineView.style.display = 'flex';
    renderLineaTiempo(data[activeView]);
  }

  function renderLineaTiempo(linea) {
    if (!linea) return;

    if (introBanner) {
      introBanner.innerHTML = `
        <div class="genealogy-banner-main">
          <span class="eyebrow" style="margin-bottom: 0.25rem;">${escapeHtml(linea.direccion)}</span>
          <h2>${escapeHtml(linea.titulo)}</h2>
          <p class="genealogy-banner-sub">${escapeHtml(linea.subtitulo)}</p>
          <p class="genealogy-banner-focus">${escapeHtml(linea.enfasis)}</p>
        </div>
        <div class="genealogy-legend">
          <span class="legend-item"><span class="legend-dot key"></span> Personaje clave (clic para abrir ficha)</span>
          ${
            activeView === 'mateo'
              ? '<span class="legend-item"><span class="legend-dot woman"></span> Las 5 mujeres de Mateo 1</span>'
              : ''
          }
          <span class="legend-item"><span class="legend-dot regular"></span> Generación del linaje</span>
        </div>
      `;
    }

    const q = normalizar(searchQuery);
    let totalVisibles = 0;

    const etapasHtml = linea.etapas
      .map(etapa => {
        const nodosFiltrados = etapa.nodos.filter(nodo => {
          const tieneFicha = Boolean(nodo.ficha_id && data.fichas[nodo.ficha_id]);
          if (activeFilter === 'clave' && !tieneFicha) return false;
          if (activeFilter === 'mujeres' && !nodo.es_mujer) return false;

          if (!q) return true;
          const ficha = tieneFicha ? data.fichas[nodo.ficha_id] : null;
          const texto = normalizar(
            `${nodo.nombre} ${nodo.nota || ''} ${ficha ? `${ficha.subtitulo} ${ficha.resumen_historia}` : ''}`
          );
          return texto.includes(q);
        });

        totalVisibles += nodosFiltrados.length;
        if (nodosFiltrados.length === 0) return '';

        return `
          <section class="genealogy-stage-card">
            <div class="genealogy-stage-header">
              <div>
                <span class="eyebrow" style="margin-bottom: 0.2rem;">${escapeHtml(etapa.numero)} · ${escapeHtml(etapa.referencia)}</span>
                <h3>${escapeHtml(etapa.titulo)}</h3>
              </div>
              <p class="genealogy-stage-desc">${escapeHtml(etapa.descripcion)}</p>
            </div>

            <div class="genealogy-timeline">
              ${nodosFiltrados
                .map(nodo => {
                  const tieneFicha = Boolean(nodo.ficha_id && data.fichas[nodo.ficha_id]);
                  const isCristo = Boolean(nodo.es_cristo);
                  const isMujer = Boolean(nodo.es_mujer);

                  const cls = [
                    'genealogy-node',
                    tieneFicha ? 'is-key' : 'is-regular',
                    isMujer ? 'is-woman' : '',
                    isCristo ? 'is-christ' : ''
                  ]
                    .filter(Boolean)
                    .join(' ');

                  if (tieneFicha) {
                    return `
                      <div class="genealogy-node-row">
                        <span class="genealogy-dot ${isCristo ? 'christ' : isMujer ? 'woman' : 'key'}" aria-hidden="true"></span>
                        <button type="button" class="${cls}" data-open-ficha="${nodo.ficha_id}">
                          <div class="genealogy-node-top">
                            <span class="genealogy-node-name">${escapeHtml(nodo.nombre)}</span>
                            <div class="genealogy-node-tags">
                              ${isMujer ? '<span class="genealogy-pill woman">Mujer en Mateo 1</span>' : ''}
                              ${isCristo ? '<span class="genealogy-pill christ">✦ Cumplimiento</span>' : '<span class="genealogy-pill key">Ver ficha →</span>'}
                            </div>
                          </div>
                          ${nodo.nota ? `<p class="genealogy-node-note">${escapeHtml(nodo.nota)}</p>` : ''}
                        </button>
                      </div>
                    `;
                  }

                  return `
                    <div class="genealogy-node-row">
                      <span class="genealogy-dot" aria-hidden="true"></span>
                      <div class="${cls}">
                        <div class="genealogy-node-top">
                          <span class="genealogy-node-name">${escapeHtml(nodo.nombre)}</span>
                        </div>
                        ${nodo.nota ? `<p class="genealogy-node-note">${escapeHtml(nodo.nota)}</p>` : ''}
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </section>
        `;
      })
      .filter(Boolean)
      .join('');

    if (totalVisibles === 0) {
      timelineView.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
          <p class="serif-title" style="font-size: 1.45rem; margin-bottom: 0.35rem;">Sin coincidencias en esta línea</p>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Prueba buscar otro nombre o alterna entre Mateo 1 y Lucas 3.</p>
        </div>
      `;
      return;
    }

    timelineView.innerHTML = etapasHtml;

    timelineView.querySelectorAll('[data-open-ficha]').forEach(btn => {
      btn.addEventListener('click', () => abrirFicha(btn.dataset.openFicha));
    });
  }

  function renderComparativa() {
    const comp = data.comparativa;
    if (introBanner) {
      introBanner.innerHTML = `
        <div class="genealogy-banner-main">
          <span class="eyebrow" style="margin-bottom: 0.25rem;">Armonía de los Evangelios · Mateo 1 vs. Lucas 3</span>
          <h2>Dos Líneas, Un Solo Salvador</h2>
          <p class="genealogy-banner-focus">${escapeHtml(comp.intro)}</p>
        </div>
      `;
    }

    compareView.innerHTML = `
      <!-- Diagrama Visual de Convergencia y Bifurcación -->
      <section class="compare-diagram-card">
        <span class="eyebrow">Mapa Visual de Convergencia</span>
        <h3 style="font-size: 1.55rem; margin-bottom: 1.25rem;">Cómo se Cruzan Mateo 1 y Lucas 3 en la Historia</h3>

        <div class="convergence-flow">
          <button type="button" class="conv-node" data-open-ficha="adan">
            <span class="conv-tag">Solo Lucas 3</span>
            <strong>Adán, hijo de Dios</strong>
            <small>Humanidad universal</small>
          </button>
          <span class="conv-arrow" aria-hidden="true">→</span>
          <button type="button" class="conv-node is-shared" data-open-ficha="abraham">
            <span class="conv-tag">Mateo + Lucas</span>
            <strong>Abraham</strong>
            <small>Pacto de promesa</small>
          </button>
          <span class="conv-arrow" aria-hidden="true">→</span>
          <button type="button" class="conv-node is-shared" data-open-ficha="david">
            <span class="conv-tag">Mateo + Lucas</span>
            <strong>Rey David</strong>
            <small>Pacto del Trono Eterno</small>
          </button>
        </div>

        <div class="convergence-split">
          <div class="split-branch mateo-branch">
            <span class="lexicon-field-label">Rama de Mateo 1 (Línea Real / Legal)</span>
            <div class="split-chain">
              <button type="button" class="split-chip" data-open-ficha="salomon">Salomón</button> →
              <button type="button" class="split-chip" data-open-ficha="ezequias">Reyes de Judá</button> →
              <button type="button" class="split-chip" data-open-ficha="jeconias">Jeconías</button> →
              <button type="button" class="split-chip" data-open-ficha="zorobabel">Zorobabel</button> →
              <button type="button" class="split-chip" data-open-ficha="jose">José (Padre legal)</button>
            </div>
            <p>Transmite a Jesús el <strong>derecho legal indiscutible al trono de David</strong> por adopción.</p>
          </div>

          <div class="split-branch lucas-branch">
            <span class="lexicon-field-label">Rama de Lucas 3 (Línea Biológica)</span>
            <div class="split-chain">
              <button type="button" class="split-chip" data-open-ficha="natan">Natán</button> →
              <span class="split-chip static">Casa humilde de David</span> →
              <button type="button" class="split-chip" data-open-ficha="zorobabel">Zorobabel</button> →
              <span class="split-chip static">Elí</span> →
              <button type="button" class="split-chip" data-open-ficha="maria">María (Madre biológica)</button>
            </div>
            <p>Transmite a Jesús la <strong>sangre davídica real</strong>, libre de la maldición sobre la simiente física de Jeconías.</p>
          </div>
        </div>

        <div class="convergence-culmination">
          <button type="button" class="conv-node is-christ" data-open-ficha="jesus">
            <span class="conv-tag">✦ Convergencia Perfecta</span>
            <strong>Jesucristo · Hijo de David · Hijo de Abraham · Hijo de Dios</strong>
            <small>Haz clic para abrir ficha teológica →</small>
          </button>
        </div>
      </section>

      <!-- Comparativa Lado a Lado -->
      <div class="compare-columns-grid">
        <article class="compare-col-card">
          <span class="eyebrow">${escapeHtml(comp.mateo_resumen.etiqueta)}</span>
          <h3>${escapeHtml(comp.mateo_resumen.titulo)}</h3>
          <dl class="compare-dl">
            ${comp.mateo_resumen.puntos
              .map(p => `<dt>${escapeHtml(p.clave)}</dt><dd>${escapeHtml(p.valor)}</dd>`)
              .join('')}
          </dl>
          <button type="button" class="btn btn-outline" data-jump-view="mateo" style="width: 100%; margin-top: 1rem;">
            Explorar línea completa de Mateo 1 →
          </button>
        </article>

        <article class="compare-col-card">
          <span class="eyebrow">${escapeHtml(comp.lucas_resumen.etiqueta)}</span>
          <h3>${escapeHtml(comp.lucas_resumen.titulo)}</h3>
          <dl class="compare-dl">
            ${comp.lucas_resumen.puntos
              .map(p => `<dt>${escapeHtml(p.clave)}</dt><dd>${escapeHtml(p.valor)}</dd>`)
              .join('')}
          </dl>
          <button type="button" class="btn btn-outline" data-jump-view="lucas" style="width: 100%; margin-top: 1rem;">
            Explorar línea completa de Lucas 3 →
          </button>
        </article>
      </div>

      <!-- 3 Claves Teológicas -->
      <section class="compare-insights-grid">
        ${comp.claves_teologicas
          .map(
            c => `
          <div class="compare-insight-card">
            <h4>${escapeHtml(c.titulo)}</h4>
            <p>${escapeHtml(c.texto)}</p>
          </div>
        `
          )
          .join('')}
      </section>
    `;

    compareView.querySelectorAll('[data-open-ficha]').forEach(btn => {
      btn.addEventListener('click', () => abrirFicha(btn.dataset.openFicha));
    });
    compareView.querySelectorAll('[data-jump-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        cambiarVista(btn.dataset.jumpView);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function abrirFicha(fichaId) {
    if (!data || !data.fichas[fichaId] || !modalBackdrop || !modalContent) return;
    const f = data.fichas[fichaId];

    // URL compartible del personaje
    const urlObj = new URL(window.location.href);
    urlObj.searchParams.set('personaje', f.id);
    window.history.replaceState({}, '', urlObj.pathname + urlObj.search);
    const shareUrl = urlObj.href;

    const mensajeWa =
      `👑 *Genealogía de Jesús: ${f.nombre}*\n` +
      `${f.subtitulo} (${f.referencia})\n\n` +
      `Explora su papel en el plan redentor de Dios en Códice Bíblico:\n${shareUrl}`;
    const waHref = `https://wa.me/?text=${encodeURIComponent(mensajeWa)}`;

    const keys = Object.keys(data.fichas);
    const idx = keys.indexOf(fichaId);
    const prevKey = idx > 0 ? keys[idx - 1] : null;
    const nextKey = idx >= 0 && idx < keys.length - 1 ? keys[idx + 1] : null;

    const badgesLinea = [
      f.en_mateo ? '<span class="panorama-cap-badge">Mateo 1</span>' : '',
      f.en_lucas ? '<span class="panorama-cap-badge">Lucas 3</span>' : '',
      f.es_mujer ? '<span class="genealogy-pill woman">Mujer en Mateo 1</span>' : ''
    ]
      .filter(Boolean)
      .join('');

    modalContent.innerHTML = `
      <button type="button" class="modal-close-btn" id="genealogy-modal-close" aria-label="Cerrar ficha">✕</button>

      <div class="genealogy-modal-head">
        <div class="panorama-modal-badges">
          <span class="eyebrow" style="margin-bottom: 0;">${escapeHtml(f.etapa)}</span>
          ${badgesLinea}
        </div>
        <h2 id="genealogy-modal-title" style="font-size: 2.2rem; margin-bottom: 0.25rem;">${escapeHtml(f.nombre)}</h2>
        <p style="font-family: var(--font-reading); font-style: italic; font-size: 1rem; color: var(--accent-bronze-dark); margin-bottom: 0.6rem;">
          ${escapeHtml(f.subtitulo)}
        </p>
        <div style="font-size: 0.82rem; color: var(--text-muted);">
          <strong>Referencia bíblica:</strong> ${escapeHtml(f.referencia)}
        </div>
      </div>

      <div class="panorama-zone" style="padding-top: 1.25rem;">
        <div class="panorama-info-card">
          <span class="lexicon-field-label">Resumen de su Historia</span>
          <p>${escapeHtml(f.resumen_historia)}</p>
        </div>

        <div class="panorama-callout-card is-christ" style="margin-top: 1rem;">
          <span class="lexicon-field-label">✦ Su Importancia en el Plan Redentor de Dios</span>
          <p>${escapeHtml(f.plan_redentor)}</p>
        </div>

        <div class="genealogy-modal-links">
          ${
            f.etymos_q
              ? `<a href="etymos.html?modo=nombres&q=${encodeURIComponent(f.etymos_q)}" class="etymos-chip">
                  📜 Significado del nombre en Etymos →
                </a>`
              : ''
          }
          ${
            f.panorama_libro
              ? `<a href="panorama.html?libro=${encodeURIComponent(f.panorama_libro)}" class="etymos-chip">
                  📖 Ver libro relacionado en Panorama Bíblico →
                </a>`
              : ''
          }
          <a href="${waHref}" target="_blank" rel="noopener noreferrer" class="etymos-chip share-chip-wa">
            💬 Compartir por WhatsApp
          </a>
        </div>

        <div class="panorama-modal-nav">
          ${
            prevKey
              ? `<button type="button" class="btn btn-outline" data-switch-ficha="${prevKey}" style="padding: 0.5rem 0.95rem; font-size: 0.8rem;">← ${escapeHtml(data.fichas[prevKey].nombre)}</button>`
              : '<span></span>'
          }
          ${
            nextKey
              ? `<button type="button" class="btn btn-outline" data-switch-ficha="${nextKey}" style="padding: 0.5rem 0.95rem; font-size: 0.8rem;">${escapeHtml(data.fichas[nextKey].nombre)} →</button>`
              : '<span></span>'
          }
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('genealogy-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', cerrarModal);

    modalContent.querySelectorAll('[data-switch-ficha]').forEach(btn => {
      btn.addEventListener('click', () => abrirFicha(btn.dataset.switchFicha));
    });

    modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    modalContent.scrollTop = 0;
  }
});
