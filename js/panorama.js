/**
 * js/panorama.js
 * Panorama Bíblico — Atlas Canónico de los 66 Libros de la Escritura.
 * Renderiza la estantería canónica por divisiones, fichas infográficas en 4 zonas,
 * conexión automática con Estudios PDF y Etymos, compartir directo y descarga de Lámina HD.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const featuredSection = document.getElementById('panorama-featured-section');
  const featuredGrid = document.getElementById('panorama-featured-grid');
  const progressPill = document.getElementById('panorama-progress-pill');
  const shelfContainer = document.getElementById('panorama-shelf-container');
  const filtersWrap = document.getElementById('panorama-filters');
  const searchInput = document.getElementById('panorama-search');
  const countEl = document.getElementById('panorama-count');
  const modalBackdrop = document.getElementById('panorama-modal-backdrop');
  const modalContent = document.getElementById('panorama-modal-content');
  const downloadModalBackdrop = document.getElementById('download-modal-backdrop');
  const downloadModalClose = document.getElementById('download-modal-close');
  const unlockForm = document.getElementById('benefactor-unlock-form');
  const emailInput = document.getElementById('benefactor-email');
  const codeInput = document.getElementById('benefactor-code');
  const errorMsg = document.getElementById('benefactor-error');

  if (!shelfContainer) return;

  let libros = [];
  let estudios = [];
  let activeFilter = 'todos';
  let searchQuery = '';
  let libroPendienteDescarga = null;

  const DIVISION_META = {
    'Pentateuco': { testamento: 'Antiguo Testamento', tag: 'AT · Ley (Torá)' },
    'Libros Históricos': { testamento: 'Antiguo Testamento', tag: 'AT · Historia del Pacto' },
    'Poéticos y Sapienciales': { testamento: 'Antiguo Testamento', tag: 'AT · Sabiduría y Alabanza' },
    'Profetas Mayores': { testamento: 'Antiguo Testamento', tag: 'AT · Profecía' },
    'Profetas Menores': { testamento: 'Antiguo Testamento', tag: 'AT · Los Doce Profetas' },
    'Evangelios': { testamento: 'Nuevo Testamento', tag: 'NT · La Vida del Rey' },
    'Historia de la Iglesia': { testamento: 'Nuevo Testamento', tag: 'NT · Expansión del Evangelio' },
    'Epístolas Paulinas': { testamento: 'Nuevo Testamento', tag: 'NT · Doctrina Apostólica' },
    'Epístolas Generales': { testamento: 'Nuevo Testamento', tag: 'NT · Cartas a la Iglesia' },
    'Profecía Apocalíptica': { testamento: 'Nuevo Testamento', tag: 'NT · Consumación' }
  };

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

  function obtenerEstudiosRelacionados(libro) {
    if (!estudios.length) return [];
    const patrones = (libro.patrones_estudio || [libro.nombre]).map(normalizar);
    return estudios.filter(est => {
      const refNorm = normalizar(est.referencia || '');
      return patrones.some(pat => {
        const regex = new RegExp(`(^|[^a-z0-9])${pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
        return regex.test(refNorm);
      });
    });
  }

  try {
    const [resLibros, resEstudios] = await Promise.all([
      fetch('data/libros.json'),
      fetch('data/estudios.json')
    ]);
    if (!resLibros.ok) throw new Error('Error cargando data/libros.json');
    libros = await resLibros.json();
    if (resEstudios.ok) {
      estudios = await resEstudios.json();
    }

    renderDestacados();
    renderEstanteria();

    // Abrir libro automáticamente si viene ?libro=id en la URL
    const params = new URLSearchParams(window.location.search);
    const libroParam = params.get('libro');
    if (libroParam) {
      const target = libros.find(l => l.id === libroParam && l.disponible);
      if (target) abrirModalLibro(target);
    }
  } catch (err) {
    console.error(err);
    shelfContainer.innerHTML = `<p style="padding: 2rem; color: var(--text-muted);">No se pudo cargar el Panorama Bíblico en este momento.</p>`;
  }

  // Filtros y búsqueda
  if (filtersWrap) {
    filtersWrap.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        filtersWrap.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderEstanteria();
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderEstanteria();
    });
  }

  // Cierre de modal
  function cerrarModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
    const url = new URL(window.location.href);
    if (url.searchParams.has('libro')) {
      url.searchParams.delete('libro');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) cerrarModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (downloadModalBackdrop && downloadModalBackdrop.classList.contains('open')) {
          downloadModalBackdrop.classList.remove('open');
        } else if (modalBackdrop.classList.contains('open')) {
          cerrarModal();
        }
      }
    });
  }

  function actualizarEstadoBotonDescarga(btn) {
    if (!btn) return;
    if (window.CodiceBenefactor && window.CodiceBenefactor.estaDesbloqueado()) {
      btn.textContent = '🖼️ Descargar Lámina HD (Habilitado)';
      btn.style.borderColor = 'var(--accent-bronze)';
      btn.style.color = 'var(--accent-bronze-dark)';
    }
  }

  if (downloadModalClose && downloadModalBackdrop) {
    downloadModalClose.addEventListener('click', () => downloadModalBackdrop.classList.remove('open'));
    downloadModalBackdrop.addEventListener('click', (e) => {
      if (e.target === downloadModalBackdrop) downloadModalBackdrop.classList.remove('open');
    });
  }

  if (unlockForm) {
    unlockForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput ? emailInput.value : '';
      const code = codeInput ? codeInput.value : '';
      const valido =
        window.CodiceBenefactor && (await window.CodiceBenefactor.validarClave(code, email));

      if (valido) {
        if (errorMsg) errorMsg.style.display = 'none';
        if (downloadModalBackdrop) downloadModalBackdrop.classList.remove('open');
        actualizarEstadoBotonDescarga(document.getElementById('btn-panorama-download-png'));
        if (libroPendienteDescarga) {
          descargarLaminaLibro(libroPendienteDescarga);
          libroPendienteDescarga = null;
        }
      } else if (errorMsg) {
        errorMsg.style.display = 'block';
      }
    });
  }

  function renderDestacados() {
    if (!featuredGrid || !featuredSection) return;
    const disponibles = libros.filter(l => l.disponible);
    if (progressPill) {
      progressPill.textContent = `${disponibles.length} de ${libros.length} fichas completas`;
    }

    if (!disponibles.length) {
      featuredSection.style.display = 'none';
      return;
    }

    // Mostrar 3 pilares destacados (Génesis, Mateo y Romanos) para mantener la vista limpia
    const pilaresIds = ['genesis', 'mateo', 'romanos'];
    const destacados = pilaresIds
      .map(id => disponibles.find(l => l.id === id))
      .filter(Boolean);
    const listaMostrar = destacados.length === 3 ? destacados : disponibles.slice(0, 3);

    featuredGrid.innerHTML = listaMostrar
      .map(libro => {
        const relCount = obtenerEstudiosRelacionados(libro).length;
        return `
          <button type="button" class="panorama-featured-card" data-open-book="${libro.id}">
            <div class="panorama-featured-top">
              <span class="eyebrow" style="margin-bottom: 0;">${escapeHtml(libro.division)} · ${libro.capitulos} cap.</span>
              <span class="panorama-ready-badge">✦ Pilar Clave</span>
            </div>
            <h3>${escapeHtml(libro.nombre)}</h3>
            <p class="panorama-featured-verse">${escapeHtml(libro.versiculo_clave?.texto || '')}</p>
            <div class="panorama-featured-meta">
              <span><strong>${escapeHtml(libro.versiculo_clave?.cita || '')}</strong></span>
              <span>${relCount > 0 ? `📖 ${relCount} ${relCount === 1 ? 'estudio' : 'estudios'} en biblioteca` : 'Ver infografía completa →'}</span>
            </div>
          </button>
        `;
      })
      .join('');

    featuredGrid.querySelectorAll('[data-open-book]').forEach(btn => {
      btn.addEventListener('click', () => {
        const book = libros.find(l => l.id === btn.dataset.openBook);
        if (book) abrirModalLibro(book);
      });
    });
  }

  function renderEstanteria() {
    const q = normalizar(searchQuery);

    const filtrados = libros.filter(libro => {
      if (activeFilter === 'disponibles' && !libro.disponible) return false;
      if (activeFilter === 'AT' && libro.testamento !== 'AT') return false;
      if (activeFilter === 'NT' && libro.testamento !== 'NT') return false;

      if (!q) return true;
      const campos = [
        libro.nombre,
        libro.abrev,
        libro.division,
        libro.autor,
        libro.proposito,
        libro.contexto_historico,
        ...(libro.temas_principales || []),
        ...(libro.personajes || []).map(p => `${p.nombre} ${p.rol}`),
        ...(libro.ubicaciones?.lugares || [])
      ].join(' ');
      return normalizar(campos).includes(q);
    });

    const disponiblesCount = filtrados.filter(l => l.disponible).length;
    if (countEl) {
      countEl.textContent =
        filtrados.length === 0
          ? '0 libros encontrados'
          : `Mostrando ${filtrados.length} ${filtrados.length === 1 ? 'libro' : 'libros'} (${disponiblesCount} con infografía interactiva disponible)`;
    }

    if (filtrados.length === 0) {
      shelfContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
          <p class="serif-title" style="font-size: 1.45rem; margin-bottom: 0.35rem;">Sin coincidencias en el canon</p>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Prueba buscar por nombre del libro (ej. Génesis, Mateo, Romanos) o cambia el filtro superior.</p>
        </div>
      `;
      return;
    }

    // Agrupar preservando el orden canónico
    const grupos = new Map();
    filtrados.forEach(libro => {
      if (!grupos.has(libro.division)) grupos.set(libro.division, []);
      grupos.get(libro.division).push(libro);
    });

    shelfContainer.innerHTML = Array.from(grupos.entries())
      .map(([division, items]) => {
        const meta = DIVISION_META[division] || { tag: items[0].testamento };
        return `
          <div class="canon-division-block">
            <div class="canon-division-header">
              <div>
                <span class="eyebrow" style="margin-bottom: 0.15rem;">${escapeHtml(meta.tag)}</span>
                <h3>${escapeHtml(division)}</h3>
              </div>
              <span class="canon-division-count">${items.length} ${items.length === 1 ? 'libro' : 'libros'}</span>
            </div>
            <div class="canon-books-grid">
              ${items
                .map(libro => {
                  const relCount = libro.disponible ? obtenerEstudiosRelacionados(libro).length : 0;
                  if (libro.disponible) {
                    return `
                      <button type="button" class="canon-book-tile is-ready" data-open-book="${libro.id}">
                        <div class="canon-book-top">
                          <span class="canon-book-num">${String(libro.orden).padStart(2, '0')}</span>
                          <span class="canon-book-status ready">Ver ficha →</span>
                        </div>
                        <div class="canon-book-name">${escapeHtml(libro.nombre)}</div>
                        <div class="canon-book-meta">
                          <span>${libro.capitulos} cap.</span>
                          ${relCount > 0 ? `<span>· ${relCount} PDF</span>` : ''}
                        </div>
                      </button>
                    `;
                  }
                  return `
                    <div class="canon-book-tile is-upcoming" aria-label="${escapeHtml(libro.nombre)} (en preparación)">
                      <div class="canon-book-top">
                        <span class="canon-book-num">${String(libro.orden).padStart(2, '0')}</span>
                        <span class="canon-book-status">Próximamente</span>
                      </div>
                      <div class="canon-book-name">${escapeHtml(libro.nombre)}</div>
                      <div class="canon-book-meta">
                        <span>${libro.capitulos} cap.</span>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        `;
      })
      .join('');

    shelfContainer.querySelectorAll('[data-open-book]').forEach(btn => {
      btn.addEventListener('click', () => {
        const book = libros.find(l => l.id === btn.dataset.openBook);
        if (book) abrirModalLibro(book);
      });
    });
  }

  function abrirModalLibro(libro) {
    if (!modalBackdrop || !modalContent || !libro || !libro.disponible) return;

    // Actualizar URL limpia para poder compartir este libro directamente
    const shareUrlObj = new URL(window.location.href);
    shareUrlObj.searchParams.set('libro', libro.id);
    window.history.replaceState({}, '', shareUrlObj.pathname + shareUrlObj.search);
    const shareUrl = shareUrlObj.href;

    const disponibles = libros.filter(l => l.disponible);
    const idxDisp = disponibles.findIndex(l => l.id === libro.id);
    const prevLibro = idxDisp > 0 ? disponibles[idxDisp - 1] : null;
    const nextLibro = idxDisp >= 0 && idxDisp < disponibles.length - 1 ? disponibles[idxDisp + 1] : null;

    const estudiosRel = obtenerEstudiosRelacionados(libro);

    const mensajeWa =
      `📜 *Panorama Bíblico: ${libro.nombre}* (${libro.division})\n` +
      `${libro.versiculo_clave?.texto || ''} (${libro.versiculo_clave?.cita || ''})\n\n` +
      `Explora su infografía completa en Códice Bíblico:\n${shareUrl}`;

    const waHref = `https://wa.me/?text=${encodeURIComponent(mensajeWa)}`;
    const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(`Panorama Bíblico: ${libro.nombre} | Códice Bíblico`)}`;

    const lugares = libro.ubicaciones?.lugares || [];
    const etiquetaUbic = libro.ubicaciones?.etiqueta || 'Escenarios y Geografía';

    modalContent.innerHTML = `
      <button type="button" class="modal-close-btn" id="panorama-modal-close" aria-label="Cerrar infografía">✕</button>

      <!-- ZONA 1: CABECERA + VERSÍCULO CLAVE + FICHA RÁPIDA -->
      <div class="panorama-modal-header">
        <div class="panorama-modal-badges">
          <span class="eyebrow" style="margin-bottom: 0;">Libro ${libro.orden} de 66 · ${escapeHtml(libro.division)}</span>
          <span class="panorama-cap-badge">${libro.capitulos} capítulos</span>
        </div>
        <h2 id="panorama-modal-title" class="panorama-book-title">${escapeHtml(libro.nombre)}</h2>

        <blockquote class="panorama-key-verse">
          <p>${escapeHtml(libro.versiculo_clave?.texto || '')}</p>
          <footer>— ${escapeHtml(libro.versiculo_clave?.cita || '')} · Versículo Clave</footer>
        </blockquote>

        <!-- Barra de acciones rápidas (Compartir + Lámina HD) -->
        <div class="panorama-modal-actions">
          <a href="${waHref}" target="_blank" rel="noopener noreferrer" class="reader-tab-btn share-btn-whatsapp">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.49 0 .14 5.35.14 11.92c0 2.1.55 4.15 1.59 5.96L0 24l6.29-1.65a11.87 11.87 0 0 0 5.77 1.47h.01c6.57 0 11.92-5.35 11.92-11.92 0-3.18-1.24-6.18-3.47-8.42zm-8.46 18.32h-.01a9.89 9.89 0 0 1-5.04-1.38l-.36-.21-3.73.98.99-3.64-.24-.37a9.86 9.86 0 0 1-1.52-5.26c0-5.46 4.45-9.91 9.92-9.91 2.65 0 5.14 1.03 7.01 2.91a9.84 9.84 0 0 1 2.9 7c0 5.47-4.45 9.88-9.92 9.88zm5.44-7.42c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z"/>
            </svg>
            Compartir en WhatsApp
          </a>
          <a href="${fbHref}" target="_blank" rel="noopener noreferrer" class="reader-tab-btn share-btn-facebook">
            Facebook
          </a>
          <button type="button" class="reader-tab-btn" id="btn-panorama-copy">
            🔗 Copiar enlace
          </button>
          <button type="button" class="reader-tab-btn" id="btn-panorama-download-png" style="margin-left: auto;">
            🖼️ Descargar Lámina HD
          </button>
        </div>

        <!-- Cuadrícula de Ficha Rápida -->
        <div class="panorama-facts-grid">
          <div class="panorama-fact-cell">
            <span class="lexicon-field-label">Quién lo escribió</span>
            <p>${escapeHtml(libro.autor)}</p>
          </div>
          <div class="panorama-fact-cell">
            <span class="lexicon-field-label">Cuándo se escribió</span>
            <p>${escapeHtml(libro.fecha)}</p>
          </div>
          <div class="panorama-fact-cell">
            <span class="lexicon-field-label">Género literario</span>
            <p>${escapeHtml(libro.genero)}</p>
          </div>
          <div class="panorama-fact-cell">
            <span class="lexicon-field-label">${escapeHtml(etiquetaUbic)}</span>
            <div class="panorama-route-chain">
              ${lugares
                .map((l, i) => `<span class="panorama-route-pill">${escapeHtml(l)}</span>${i < lugares.length - 1 ? '<span class="panorama-route-arrow">→</span>' : ''}`)
                .join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- ZONA 2: CONTEXTO HISTÓRICO, PROPÓSITO Y PERSONAJES -->
      <div class="panorama-zone">
        <div class="panorama-two-col">
          <div class="panorama-info-card">
            <span class="lexicon-field-label">Qué estaba sucediendo (Contexto Histórico)</span>
            <p>${escapeHtml(libro.contexto_historico)}</p>
          </div>
          <div class="panorama-info-card">
            <span class="lexicon-field-label">Por qué se escribió (Propósito)</span>
            <p>${escapeHtml(libro.proposito)}</p>
          </div>
        </div>

        <div class="panorama-subblock">
          <span class="lexicon-field-label" style="margin-bottom: 0.65rem; display: block;">Personajes Clave del Libro</span>
          <div class="panorama-characters-grid">
            ${(libro.personajes || [])
              .map(p => {
                if (p.etymos_q) {
                  return `
                    <a href="etymos.html?modo=nombres&q=${encodeURIComponent(p.etymos_q)}" class="panorama-char-card has-etymos" title="Explorar el significado de ${escapeHtml(p.nombre)} en Etymos">
                      <div class="panorama-char-top">
                        <strong>${escapeHtml(p.nombre)}</strong>
                        <span class="panorama-char-etymos">Etymos →</span>
                      </div>
                      <span>${escapeHtml(p.rol)}</span>
                    </a>
                  `;
                }
                return `
                  <div class="panorama-char-card">
                    <div class="panorama-char-top">
                      <strong>${escapeHtml(p.nombre)}</strong>
                    </div>
                    <span>${escapeHtml(p.rol)}</span>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>

      <!-- ZONA 3: MAPA TEOLÓGICO VISUAL -->
      <div class="panorama-zone">
        <span class="lexicon-field-label" style="margin-bottom: 0.7rem; display: block;">Estructura Visual del Libro</span>
        <div class="panorama-structure-grid">
          ${(libro.estructura || [])
            .map(
              m => `
            <div class="panorama-struct-card">
              <span class="panorama-struct-caps">${escapeHtml(m.capitulos)}</span>
              <h4>${escapeHtml(m.bloque)}</h4>
              <p>${escapeHtml(m.resumen)}</p>
            </div>
          `
            )
            .join('')}
        </div>

        <div class="panorama-subblock">
          <span class="lexicon-field-label" style="margin-bottom: 0.55rem; display: block;">Temas Principales</span>
          <div class="panorama-themes-bar">
            ${(libro.temas_principales || [])
              .map(t => `<span class="panorama-theme-pill">${escapeHtml(t)}</span>`)
              .join('')}
          </div>
        </div>

        <div class="panorama-info-card" style="margin-top: 1.25rem;">
          <span class="lexicon-field-label">Cómo encaja en la Gran Historia de la Redención</span>
          <p>${escapeHtml(libro.historia_redentora)}</p>
        </div>

        <div class="panorama-two-col" style="margin-top: 1.15rem;">
          <div class="panorama-callout-card is-warning">
            <span class="lexicon-field-label">Clave para No Malinterpretarlo</span>
            <p>${escapeHtml(libro.clave_lectura)}</p>
          </div>
          <div class="panorama-callout-card is-christ">
            <span class="lexicon-field-label">✦ Cristo en ${escapeHtml(libro.nombre)} (Lucas 24:27)</span>
            <p>${escapeHtml(libro.cristo_en_el_libro)}</p>
          </div>
        </div>
      </div>

      <!-- ZONA 4: PUENTES CON TU BIBLIOTECA (ESTUDIOS PDF + ETYMOS) -->
      <div class="panorama-zone panorama-bridges">
        ${
          estudiosRel.length > 0
            ? `
          <div class="panorama-subblock" style="margin-top: 0;">
            <div class="panorama-bridge-head">
              <span class="lexicon-field-label" style="margin-bottom: 0;">📖 Estudios PDF de Códice Bíblico sobre ${escapeHtml(libro.nombre)} (${estudiosRel.length})</span>
            </div>
            <div class="panorama-studies-list">
              ${estudiosRel
                .slice(0, 6)
                .map(
                  st => `
                <a href="estudio.html?id=${encodeURIComponent(st.id)}" class="panorama-study-pill">
                  <span class="panorama-study-ed">${escapeHtml(st.serie)} · ${escapeHtml(st.edicion || 'Estudio')}</span>
                  <strong>${escapeHtml(st.titulo)}</strong>
                </a>
              `
                )
                .join('')}
            </div>
            ${
              estudiosRel.length > 6
                ? `<div style="margin-top: 0.75rem;">
                    <a href="index.html" class="lexicon-study-anchor">Ver los ${estudiosRel.length} estudios relacionados en el catálogo →</a>
                   </div>`
                : ''
            }
          </div>
        `
            : ''
        }

        <div class="etymos-chips-bar" style="margin-top: ${estudiosRel.length > 0 ? '1.25rem' : '0'}; border-top: ${estudiosRel.length > 0 ? '1px solid var(--border-subtle)' : 'none'}; padding-top: ${estudiosRel.length > 0 ? '1.15rem' : '0'};">
          <span class="lexicon-field-label" style="margin-bottom: 0;">Raíces clave en Etymos:</span>
          ${(libro.terminos_etymos || [])
            .map(
              t => `
            <a href="etymos.html?q=${encodeURIComponent(t)}" class="etymos-chip">
              📜 Explorar «${escapeHtml(t)}» →
            </a>
          `
            )
            .join('')}
        </div>

        <!-- Navegación rápida entre fichas disponibles -->
        <div class="panorama-modal-nav">
          ${
            prevLibro
              ? `<button type="button" class="btn btn-outline" data-switch-book="${prevLibro.id}" style="padding: 0.55rem 1rem; font-size: 0.82rem;">← ${escapeHtml(prevLibro.nombre)}</button>`
              : '<span></span>'
          }
          ${
            nextLibro
              ? `<button type="button" class="btn btn-outline" data-switch-book="${nextLibro.id}" style="padding: 0.55rem 1rem; font-size: 0.82rem;">${escapeHtml(nextLibro.nombre)} →</button>`
              : '<span></span>'
          }
        </div>
      </div>
    `;

    // Bind eventos internos del modal
    const closeBtn = document.getElementById('panorama-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', cerrarModal);

    const copyBtn = document.getElementById('btn-panorama-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareUrl);
          }
          const prev = copyBtn.textContent;
          copyBtn.textContent = '✓ Enlace copiado';
          setTimeout(() => {
            copyBtn.textContent = prev;
          }, 2000);
        } catch (err) {
          console.error(err);
        }
      });
    }

    const dlBtn = document.getElementById('btn-panorama-download-png');
    if (dlBtn) {
      actualizarEstadoBotonDescarga(dlBtn);
      dlBtn.addEventListener('click', () => {
        if (window.CodiceBenefactor && window.CodiceBenefactor.estaDesbloqueado()) {
          descargarLaminaLibro(libro);
        } else if (downloadModalBackdrop) {
          libroPendienteDescarga = libro;
          if (errorMsg) errorMsg.style.display = 'none';
          downloadModalBackdrop.classList.add('open');
        }
      });
    }

    modalContent.querySelectorAll('[data-switch-book]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = libros.find(l => l.id === btn.dataset.switchBook);
        if (target) {
          abrirModalLibro(target);
          modalContent.scrollTop = 0;
        }
      });
    });

    modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    modalContent.scrollTop = 0;
  }

  // Generador de Lámina Panorámica HD (PNG) en Canvas
  function descargarLaminaLibro(libro) {
    const W = 1600;
    const H = 2260;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    function drawWrapped(text, x, y, maxW, lineH, font, color, align = 'left') {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      const words = String(text || '').split(' ');
      let line = '';
      let curY = y;
      for (let n = 0; n < words.length; n++) {
        const test = line + words[n] + ' ';
        if (ctx.measureText(test).width > maxW && n > 0) {
          ctx.fillText(line.trim(), x, curY);
          line = words[n] + ' ';
          curY += lineH;
        } else {
          line = test;
        }
      }
      if (line.trim()) {
        ctx.fillText(line.trim(), x, curY);
        curY += lineH;
      }
      return curY;
    }

    // Fondo Pergamino + Marco Doble Bronce
    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#9A7B3E';
    ctx.lineWidth = 4;
    ctx.strokeRect(48, 48, W - 96, H - 96);
    ctx.strokeStyle = '#DECBA4';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(62, 62, W - 124, H - 124);

    // Cabecera
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9A7B3E';
    ctx.font = 'bold 21px Inter, sans-serif';
    ctx.fillText(`CÓDICE BÍBLICO  ·  PANORAMA BÍBLICO  ·  ${libro.division.toUpperCase()} (${libro.capitulos} CAP.)`, W / 2, 125);

    ctx.fillStyle = '#161618';
    ctx.font = 'bold 68px Georgia, serif';
    ctx.fillText(libro.nombre, W / 2, 205);

    let y = drawWrapped(
      `${libro.versiculo_clave?.texto || ''}  — ${libro.versiculo_clave?.cita || ''}`,
      W / 2,
      258,
      W - 260,
      36,
      'italic 25px Georgia, serif',
      '#7A5F2B',
      'center'
    );

    // Datos rápidos
    y += 24;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(100, y, W - 200, 155);
    ctx.strokeStyle = '#DECBA4';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, y, W - 200, 155);

    drawWrapped(`AUTOR: ${libro.autor}`, 130, y + 46, 650, 28, '600 20px Inter, sans-serif', '#161618', 'left');
    drawWrapped(`FECHA: ${libro.fecha}`, 130, y + 104, 650, 28, '600 20px Inter, sans-serif', '#4A4A50', 'left');
    drawWrapped(`GÉNERO: ${libro.genero}`, 820, y + 46, 650, 28, '600 20px Inter, sans-serif', '#161618', 'left');
    drawWrapped(`GEOGRAFÍA: ${(libro.ubicaciones?.lugares || []).join(' → ')}`, 820, y + 104, 650, 28, '600 20px Inter, sans-serif', '#7A5F2B', 'left');

    // Contexto y Propósito
    y += 195;
    ctx.fillStyle = '#9A7B3E';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('I. CONTEXTO HISTÓRICO Y PROPÓSITO', 100, y);

    y += 24;
    const halfW = 680;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(100, y, halfW, 310);
    ctx.strokeStyle = '#E6E1D8';
    ctx.strokeRect(100, y, halfW, 310);
    drawWrapped('Qué estaba sucediendo', 128, y + 44, halfW - 56, 30, 'bold 24px Georgia, serif', '#161618', 'left');
    drawWrapped(libro.contexto_historico, 128, y + 84, halfW - 56, 29, '400 20px Inter, sans-serif', '#4A4A50', 'left');

    const col2X = 100 + halfW + 40;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(col2X, y, halfW, 310);
    ctx.strokeStyle = '#E6E1D8';
    ctx.strokeRect(col2X, y, halfW, 310);
    drawWrapped('Por qué se escribió', col2X + 28, y + 44, halfW - 56, 30, 'bold 24px Georgia, serif', '#161618', 'left');
    drawWrapped(libro.proposito, col2X + 28, y + 84, halfW - 56, 29, '400 20px Inter, sans-serif', '#4A4A50', 'left');

    // Estructura en Movimientos
    y += 360;
    ctx.fillStyle = '#9A7B3E';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText('II. ESTRUCTURA VISUAL DEL LIBRO', 100, y);

    y += 24;
    const moves = (libro.estructura || []).slice(0, 4);
    const gap = 24;
    const cardW = Math.floor((W - 200 - gap * (moves.length - 1)) / moves.length);
    const cardH = 320;
    moves.forEach((m, idx) => {
      const bx = 100 + idx * (cardW + gap);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(bx, y, cardW, cardH);
      ctx.strokeStyle = '#DECBA4';
      ctx.strokeRect(bx, y, cardW, cardH);
      ctx.fillStyle = '#9A7B3E';
      ctx.fillRect(bx, y, cardW, 7);

      drawWrapped(m.capitulos, bx + 20, y + 40, cardW - 40, 24, 'bold 17px Inter, sans-serif', '#9A7B3E', 'left');
      const ty = drawWrapped(m.bloque, bx + 20, y + 76, cardW - 40, 28, 'bold 22px Georgia, serif', '#161618', 'left');
      drawWrapped(m.resumen, bx + 20, ty + 12, cardW - 40, 26, '400 18px Inter, sans-serif', '#4A4A50', 'left');
    });

    // Personajes y Temas
    y += cardH + 45;
    ctx.fillStyle = '#9A7B3E';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText('III. PERSONAJES CLAVE Y ENCAJE EN LA HISTORIA REDENTORA', 100, y);

    y += 26;
    const charsLine = (libro.personajes || []).map(p => `${p.nombre} (${p.rol})`).join('  ·  ');
    y = drawWrapped(`Personajes: ${charsLine}`, 100, y + 20, W - 200, 29, '500 20px Inter, sans-serif', '#2B2B30', 'left');
    y = drawWrapped(libro.historia_redentora, 100, y + 18, W - 200, 30, '400 21px Inter, sans-serif', '#4A4A50', 'left');

    // Cristo en el Libro + Clave de Lectura
    y += 34;
    const callH = 310;
    ctx.fillStyle = '#FAF5F4';
    ctx.fillRect(100, y, halfW, callH);
    ctx.strokeStyle = '#E3C9C5';
    ctx.strokeRect(100, y, halfW, callH);
    drawWrapped('Clave para No Malinterpretarlo', 128, y + 46, halfW - 56, 30, 'bold 25px Georgia, serif', '#7F2D24', 'left');
    drawWrapped(libro.clave_lectura, 128, y + 90, halfW - 56, 30, '400 20px Inter, sans-serif', '#4A4A50', 'left');

    ctx.fillStyle = '#F7F2E7';
    ctx.fillRect(col2X, y, halfW, callH);
    ctx.strokeStyle = '#DECBA4';
    ctx.strokeRect(col2X, y, halfW, callH);
    drawWrapped(`✦ Cristo en ${libro.nombre}`, col2X + 28, y + 46, halfW - 56, 30, 'bold 25px Georgia, serif', '#7A5F2B', 'left');
    drawWrapped(libro.cristo_en_el_libro, col2X + 28, y + 90, halfW - 56, 30, '400 20px Inter, sans-serif', '#2B2B30', 'left');

    // Pie
    ctx.textAlign = 'center';
    ctx.font = 'italic 26px Georgia, serif';
    ctx.fillStyle = '#7A5F2B';
    ctx.fillText('Códice Bíblico  ·  Panorama Bíblico  ·  Soli Deo Gloria  ·  codicebiblico.netlify.app', W / 2, H - 85);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `Panorama-Codice-Biblico-${libro.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
});
