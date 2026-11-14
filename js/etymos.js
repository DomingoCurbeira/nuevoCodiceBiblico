/**
 * js/etymos.js
 * Diccionario Exegético (Hebreo, Griego y Arameo) + Nombres Bíblicos (Diseño y Cambio de Nombre)
 * Incluye Fichas Visuales Expandibles (Modal) y Conexión Directa con Estudios en PDF.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const modeButtons = document.querySelectorAll('.mode-btn');
  const langFiltersWrap = document.getElementById('etymos-lang-filters');
  const nameFiltersWrap = document.getElementById('etymos-name-filters');
  const searchInput = document.getElementById('etymos-search');
  const resultsCountEl = document.getElementById('etymos-count');
  const lexiconContainer = document.getElementById('lexicon-results');
  const namesContainer = document.getElementById('names-results');
  const modalBackdrop = document.getElementById('etymos-modal-backdrop');
  const modalContent = document.getElementById('etymos-modal-content');

  if (!lexiconContainer || !namesContainer) return;

  let data = { palabras: [], nombres: [] };
  let activeMode = 'lexico'; // 'lexico' | 'nombres'
  let activeIdioma = 'todos';
  let activeNameFilter = 'cambio';
  let searchQuery = '';

  // Leer parámetro ?q= si viene desde un estudio
  const urlParams = new URLSearchParams(window.location.search);
  const initialQ = urlParams.get('q');
  if (initialQ) {
    searchQuery = initialQ.trim();
    if (searchInput) searchInput.value = searchQuery;
  }

  const normalizar = (str) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  try {
    const res = await fetch('data/etymos.json');
    if (!res.ok) throw new Error('Error cargando Etymos');
    data = await res.json();
    render();
  } catch (err) {
    console.error(err);
    lexiconContainer.innerHTML = `<p style="padding:2rem; color:var(--text-muted);">No se pudo cargar el diccionario exegético.</p>`;
  }

  // Cerrar modal
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        modalBackdrop.classList.remove('open');
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') modalBackdrop.classList.remove('open');
    });
  }

  // Cambiar entre Léxico Exegético y Nombres Bíblicos
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      activeMode = btn.dataset.mode;
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (activeMode === 'lexico') {
        langFiltersWrap.style.display = 'flex';
        nameFiltersWrap.style.display = 'none';
        lexiconContainer.style.display = 'grid';
        namesContainer.style.display = 'none';
        if (searchInput) {
          searchInput.placeholder = 'Buscar palabra en Griego, Hebreo, Arameo o español (ej. Hesed, Gracia, Logos, Kabod)...';
        }
      } else {
        langFiltersWrap.style.display = 'none';
        nameFiltersWrap.style.display = 'flex';
        lexiconContainer.style.display = 'none';
        namesContainer.style.display = 'grid';
        if (searchInput) {
          searchInput.placeholder = 'Buscar nombre bíblico (ej. Jacob, Israel, Abram, Abraham, Simón, Pedro, Saulo)...';
        }
      }
      render();
    });
  });

  if (langFiltersWrap) {
    langFiltersWrap.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeIdioma = btn.dataset.idioma;
        langFiltersWrap.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render();
      });
    });
  }

  if (nameFiltersWrap) {
    nameFiltersWrap.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeNameFilter = btn.dataset.tipo;
        nameFiltersWrap.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
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

  function render() {
    if (activeMode === 'lexico') {
      renderLexico();
    } else {
      renderNombres();
    }
  }

  function renderLexico() {
    const q = normalizar(searchQuery);

    const filtradas = data.palabras.filter(item => {
      const idiomaNorm = normalizar(item.idioma);
      const pasaIdioma = activeIdioma === 'todos' || idiomaNorm.includes(activeIdioma);
      if (!pasaIdioma) return false;
      if (!q) return true;

      const haystack = normalizar(
        `${item.termino} ${item.original} ${item.transliteracion} ${item.strong || ''} ${item.raiz} ${item.significado_exegetico} ${item.cita}`
      );
      return haystack.includes(q);
    });

    if (resultsCountEl) {
      resultsCountEl.textContent = `${filtradas.length} ${filtradas.length === 1 ? 'término exegético' : 'términos exegéticos'}`;
    }

    if (filtradas.length === 0) {
      lexiconContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
          <p class="serif-title" style="font-size: 1.35rem; margin-bottom: 0.35rem;">No se encontraron términos</p>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Prueba buscando por transliteración, raíz o concepto en español.</p>
        </div>
      `;
      return;
    }

    const visibles = filtradas.slice(0, 60);

    lexiconContainer.innerHTML = visibles
      .map(item => {
        const idiomaNorm = normalizar(item.idioma);
        let badgeClass = 'lang-hebreo';
        if (idiomaNorm.includes('grieg')) badgeClass = 'lang-griego';
        else if (idiomaNorm.includes('aram')) badgeClass = 'lang-arameo';

        const termino = item.termino || item.palabra_espanol || '';
        const translit = item.transliteracion || '';
        const original = item.original || '';
        const raiz = item.raiz || item.esencia_antigua || '';
        const significado = item.significado_exegetico || item.sentido_verdad || item.definicion_corta || '';
        const strongTag = item.strong
          ? `<span class="lang-badge" style="background:var(--bg-subtle); color:var(--text-secondary); margin-right:0.35rem;">Strong ${item.strong}</span>`
          : '';
        const rel = item.estudio_relacionado || { id: 'gracia-soberana', titulo: 'La Gracia Soberana' };

        return `
          <article class="lexicon-card">
            <div class="lexicon-header">
              <div>
                <h2 class="lexicon-term-title">${termino}</h2>
                <div class="lexicon-translit">Transliteración: <strong>${translit}</strong></div>
              </div>
              <div style="text-align: right;">
                <div class="lexicon-original" lang="he">${original}</div>
                <div style="margin-top:0.25rem;">${strongTag}<span class="lang-badge ${badgeClass}">${item.idioma || 'Hebreo'}</span></div>
              </div>
            </div>

            <div>
              <div class="lexicon-field-label">Raíz Etimológica</div>
              <p class="lexicon-root">${raiz}</p>
            </div>

            <div>
              <div class="lexicon-field-label">Significado Exegético</div>
              <p class="lexicon-meaning">${significado}</p>
            </div>

            ${
              item.cita
                ? `<div style="font-size: 0.82rem; font-style: italic; color: var(--text-muted);">
                     «${item.versiculo}» — <strong>${item.cita}</strong>
                   </div>`
                : ''
            }

            ${
              item.cristologia
                ? `<div class="lexicon-christ">
                     <div class="lexicon-field-label" style="margin-bottom:0.25rem;">Cumplimiento Cristocéntrico</div>
                     ${item.cristologia}
                   </div>`
                : ''
            }

            <div class="lexicon-study-link">
              <a href="estudio.html?id=${encodeURIComponent(rel.id)}" class="lexicon-study-anchor">
                📖 Estudio: ${rel.titulo}
              </a>
              <button type="button" class="btn-open-modal" data-word-id="${item.id}">
                📐 Esquema
              </button>
            </div>
          </article>
        `;
      })
      .join('');

    lexiconContainer.querySelectorAll('.btn-open-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        const word = data.palabras.find(p => p.id === btn.dataset.wordId);
        if (word) abrirModalPalabra(word);
      });
    });
  }

  function renderNombres() {
    const q = normalizar(searchQuery);

    const filtrados = data.nombres.filter(item => {
      if (activeNameFilter === 'cambio' && !item.tiene_cambio) return false;
      if (!q) return true;

      const n0 = item.nombre_nacimiento || {};
      const n1 = item.nombre_nuevo || {};
      const haystack = normalizar(
        `${n0.nombre} ${n0.titulo} ${n0.original} ${n0.transliteracion} ${n0.significado} ${n1.nombre || ''} ${n1.titulo || ''} ${n1.transliteracion || ''} ${n1.significado || ''}`
      );
      return haystack.includes(q);
    });

    if (resultsCountEl) {
      resultsCountEl.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'registro onomástico' : 'registros onomásticos'}`;
    }

    if (filtrados.length === 0) {
      namesContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
          <p class="serif-title" style="font-size: 1.35rem; margin-bottom: 0.35rem;">No se encontraron nombres bíblicos</p>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Intenta buscar «Jacob», «Israel», «Abram», «Simón» o cambia el filtro a «Todos los Nombres».</p>
        </div>
      `;
      return;
    }

    namesContainer.innerHTML = filtrados
      .map(item => {
        const n0 = item.nombre_nacimiento;
        const n1 = item.nombre_nuevo;
        const rel = item.estudio_relacionado || { id: 'gracia-soberana', titulo: 'La Gracia Soberana' };

        if (item.tiene_cambio && n1) {
          return `
            <article class="name-card">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                <span class="eyebrow" style="margin-bottom:0;">Redención de Identidad</span>
                <span class="lang-badge lang-hebreo">${item.seccion_biblica}</span>
              </div>

              <div class="name-comparison">
                <div class="name-phase birth">
                  <span class="phase-tag">1. Nombre de Nacimiento (Carne)</span>
                  <div class="phase-name">${n0.nombre}</div>
                  <div class="phase-original">${n0.original} · <em>${n0.transliteracion}</em></div>
                  <p class="phase-meaning">${n0.significado}</p>
                </div>

                <div class="name-arrow" aria-hidden="true" title="Intervención del Pacto de Dios">✦ →</div>

                <div class="name-phase divine">
                  <span class="phase-tag">2. Nombre dado por Dios (Pacto)</span>
                  <div class="phase-name">${n1.nombre}</div>
                  <div class="phase-original">${n1.original} · <em>${n1.transliteracion}</em></div>
                  <p class="phase-meaning">${n1.significado}</p>
                </div>
              </div>

              <div class="name-exegesis">
                <div class="lexicon-field-label">Análisis Exegético del Cambio</div>
                <p style="margin-bottom: 0.6rem;">${n1.exegesis || n0.exegesis}</p>
                ${
                  item.cristologia
                    ? `<p style="font-size: 0.84rem; color: var(--accent-bronze-dark);"><strong>Sombra Cristocéntrica:</strong> ${item.cristologia}</p>`
                    : ''
                }
              </div>

              <div class="lexicon-study-link">
                <a href="estudio.html?id=${encodeURIComponent(rel.id)}" class="lexicon-study-anchor">
                  📖 Profundizar en PDF: ${rel.titulo}
                </a>
              </div>
            </article>
          `;
        }

        return `
          <article class="name-card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="eyebrow" style="margin-bottom:0;">Diseño Original</span>
              <span class="lang-badge lang-hebreo">${item.seccion_biblica}</span>
            </div>
            <div class="name-phase divine">
              <span class="phase-tag">${n0.titulo}</span>
              <div class="phase-name">${n0.nombre}</div>
              <div class="phase-original">${n0.original} · <em>${n0.transliteracion}</em></div>
              <p class="phase-meaning">${n0.significado}</p>
            </div>
            <div class="name-exegesis">
              <div class="lexicon-field-label">Significado Teológico</div>
              <p>${n0.exegesis}</p>
            </div>
            <div class="lexicon-study-link">
              <a href="estudio.html?id=${encodeURIComponent(rel.id)}" class="lexicon-study-anchor">
                📖 Profundizar en PDF: ${rel.titulo}
              </a>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function abrirModalPalabra(word) {
    if (!modalBackdrop || !modalContent) return;
    const rel = word.estudio_relacionado || { id: 'gracia-soberana', titulo: 'La Gracia Soberana' };

    modalContent.innerHTML = `
      <button type="button" class="modal-close-btn" id="modal-close-btn" aria-label="Cerrar ficha">✕</button>
      <span class="eyebrow">Ficha Exegética Visual · ${word.idioma} ${word.strong ? `· Strong ${word.strong}` : ''}</span>
      <div style="display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--border-subtle);">
        <div>
          <h2 id="etymos-modal-title" style="font-size:2rem;">${word.termino}</h2>
          <p class="lexicon-translit" style="font-size:1rem;">Transliteración fonética: <strong>${word.transliteracion}</strong></p>
        </div>
        <div class="lexicon-original" style="font-size:2.75rem;">${word.original}</div>
      </div>

      <!-- Diagrama de 3 Esferas Exegéticas -->
      <div class="flow-diagram" style="margin-bottom:1.5rem;">
        <div class="flow-step-card">
          <div class="lexicon-field-label">1. Raíz Etimológica</div>
          <p class="flow-step-desc" style="color:var(--text-primary); font-weight:500;">${word.raiz}</p>
        </div>
        <div class="flow-step-card">
          <div class="lexicon-field-label">2. Sentido Exegético</div>
          <p class="flow-step-desc">${word.significado_exegetico}</p>
        </div>
        <div class="flow-step-card">
          <div class="lexicon-field-label">3. Revelación en Cristo</div>
          <p class="flow-step-desc">${word.cristologia || 'En Cristo se cumple la sustancia eterna de este diseño bíblico.'}</p>
        </div>
      </div>

      ${
        word.cita
          ? `<div style="background:var(--bg-page); border-left:3px solid var(--accent-bronze); padding:1rem 1.25rem; margin-bottom:1.5rem; font-family:var(--font-reading); font-style:italic;">
               «${word.versiculo}» — <strong>${word.cita}</strong>
             </div>`
          : ''
      }

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; padding-top:1rem; border-top:1px solid var(--border-subtle);">
        <span style="font-size:0.84rem; color:var(--text-muted);">Estudio teológico recomendado para profundizar:</span>
        <a href="estudio.html?id=${encodeURIComponent(rel.id)}" class="btn btn-bronze" style="padding:0.65rem 1.2rem;">
          📖 Leer PDF: ${rel.titulo}
        </a>
      </div>
    `;

    modalBackdrop.classList.add('open');
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => modalBackdrop.classList.remove('open'));
    }
  }
});
