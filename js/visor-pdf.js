/**
 * js/visor-pdf.js
 * Visor de estudios teológicos basado en Mozilla PDF.js (<canvas> puro).
 * Renderiza todas las páginas del documento completo sin capa de texto seleccionable.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const studyId = params.get('id') || 'bautismo';

  const stageEl = document.getElementById('pdf-canvas-stage');
  const wrapperEl = document.getElementById('pdf-protected-wrapper');
  const pageIndicatorEl = document.getElementById('pdf-page-indicator');
  const btnPrev = document.getElementById('pdf-prev-page');
  const btnNext = document.getElementById('pdf-next-page');
  const btnZoomIn = document.getElementById('pdf-zoom-in');
  const btnZoomOut = document.getElementById('pdf-zoom-out');
  const zoomLabel = document.getElementById('pdf-zoom-label');
  const btnFullscreen = document.getElementById('pdf-fullscreen');

  // Elementos de la barra lateral
  const titleEl = document.getElementById('study-title');
  const seriesEl = document.getElementById('study-series');
  const refEl = document.getElementById('study-ref');
  const descEl = document.getElementById('study-desc');
  const breadcrumbTitleEl = document.getElementById('breadcrumb-study-title');
  const downloadBtnEl = document.getElementById('btn-official-pdf');

  // 1. Bloqueo de clic derecho, selección, arrastre y atajos de guardado/impresión
  const bloquearEvento = (e) => {
    e.preventDefault();
    return false;
  };

  if (wrapperEl) {
    wrapperEl.addEventListener('contextmenu', bloquearEvento);
    wrapperEl.addEventListener('selectstart', bloquearEvento);
    wrapperEl.addEventListener('dragstart', bloquearEvento);
    wrapperEl.addEventListener('copy', bloquearEvento);
    wrapperEl.addEventListener('cut', bloquearEvento);
  }

  window.addEventListener('keydown', (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const key = (e.key || '').toLowerCase();
    if (isCtrlOrCmd && (key === 's' || key === 'p' || key === 'c' || key === 'u')) {
      e.preventDefault();
      return false;
    }
  });

  // 2. Cargar metadatos del estudio
  let estudios = [];
  let estudio = null;
  try {
    const res = await fetch('data/estudios.json');
    estudios = await res.json();
    estudio = estudios.find(s => s.id === studyId || s.slug === studyId) || estudios[0];
  } catch (err) {
    console.error('Error cargando metadatos del estudio:', err);
  }

  if (!estudio) {
    if (stageEl) {
      stageEl.innerHTML = `<p style="color:#E4E2DD; padding:3rem;">Estudio no encontrado.</p>`;
    }
    return;
  }

  const escapeHtml = (str) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  function obtenerNumeroEpisodio(edicionStr) {
    const limpio = String(edicionStr || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (/\b(introduccion|prologo)\b/.test(limpio)) return 0;
    if (/\b(conclusion|epilogo)\b/.test(limpio)) return 9998;
    const match = String(edicionStr || '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 999;
  }

  // Poblar ficha técnica e información del estudio
  document.title = `${estudio.titulo} | Códice Bíblico`;
  if (titleEl) titleEl.textContent = estudio.titulo;
  if (seriesEl) seriesEl.textContent = `${estudio.serie} · ${estudio.edicion || 'Estudio'}`;
  if (refEl) refEl.textContent = `Pasajes base: ${estudio.referencia}`;
  if (descEl) descEl.textContent = estudio.subtitulo;
  if (breadcrumbTitleEl) breadcrumbTitleEl.textContent = estudio.titulo;
  if (downloadBtnEl && estudio.apoyoUrl) {
    downloadBtnEl.href = estudio.apoyoUrl;
  }

  // 2b. Configurar botones directos de Compartir (WhatsApp, Facebook y Copiar enlace)
  (function inicializarCompartir() {
    const shareUrl = window.location.href;
    const mensajeWhatsApp =
      `📖 *${estudio.titulo}*\n` +
      `${estudio.serie} · ${estudio.edicion || 'Estudio Bíblico'}\n` +
      `Pasajes: ${estudio.referencia}\n\n` +
      `Léelo gratis en Códice Bíblico:\n${shareUrl}`;

    const waHref = `https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp)}`;
    const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(estudio.titulo)}`;

    ['btn-share-whatsapp', 'sidebar-share-whatsapp'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.href = waHref;
    });

    ['btn-share-facebook', 'sidebar-share-facebook'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.href = fbHref;
    });

    const copiarEnlace = async (btn) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(shareUrl);
        } else {
          const temp = document.createElement('input');
          temp.value = shareUrl;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          temp.remove();
        }
        const prev = btn.textContent;
        btn.textContent = '✓ Enlace copiado';
        setTimeout(() => {
          btn.textContent = prev;
        }, 2000);
      } catch (err) {
        console.error('No se pudo copiar el enlace:', err);
      }
    };

    ['btn-share-study', 'sidebar-share-copy'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => copiarEnlace(btn));
    });
  })();

  // 2c. Renderizar navegación de continuidad (Episodio Anterior / Siguiente Episodio)
  (function renderizarNavegacionEpisodios() {
    const bottomNavEl = document.getElementById('episode-nav-bottom');
    const sidebarNavEl = document.getElementById('episode-nav-sidebar');
    if (!estudios.length || (!bottomNavEl && !sidebarNavEl)) return;

    const serieEstudios = estudios
      .filter(s => s.serie === estudio.serie)
      .sort((a, b) => {
        const epA = obtenerNumeroEpisodio(a.edicion);
        const epB = obtenerNumeroEpisodio(b.edicion);
        if (epA !== epB) return epA - epB;
        return (a.titulo || '').localeCompare(b.titulo || '', 'es');
      });

    const currentIdx = serieEstudios.findIndex(s => s.id === estudio.id);
    if (currentIdx === -1 || serieEstudios.length <= 1) return;

    const prevEstudio = currentIdx > 0 ? serieEstudios[currentIdx - 1] : null;
    const nextEstudio = currentIdx < serieEstudios.length - 1 ? serieEstudios[currentIdx + 1] : null;

    if (!prevEstudio && !nextEstudio) return;

    const acortarTitulo = (t) => {
      const idx = t.indexOf(':');
      if (idx > 14 && idx < 56) return t.slice(0, idx);
      return t.length > 64 ? `${t.slice(0, 61)}…` : t;
    };

    if (bottomNavEl) {
      bottomNavEl.style.display = 'block';
      bottomNavEl.innerHTML = `
        <div class="episode-nav-header">
          <span class="eyebrow" style="margin-bottom: 0;">Continuar en la serie · ${escapeHtml(estudio.serie)}</span>
          <span class="episode-nav-position">Estudio ${currentIdx + 1} de ${serieEstudios.length}</span>
        </div>
        <div class="episode-nav-grid">
          ${
            prevEstudio
              ? `<a href="estudio.html?id=${encodeURIComponent(prevEstudio.id)}" class="episode-nav-card prev">
                  <span class="episode-nav-dir">← Episodio Anterior · ${escapeHtml(prevEstudio.edicion || 'Estudio')}</span>
                  <span class="episode-nav-title">${escapeHtml(acortarTitulo(prevEstudio.titulo))}</span>
                </a>`
              : `<div class="episode-nav-card empty" aria-hidden="true"></div>`
          }
          ${
            nextEstudio
              ? `<a href="estudio.html?id=${encodeURIComponent(nextEstudio.id)}" class="episode-nav-card next">
                  <span class="episode-nav-dir">Siguiente Episodio · ${escapeHtml(nextEstudio.edicion || 'Estudio')} →</span>
                  <span class="episode-nav-title">${escapeHtml(acortarTitulo(nextEstudio.titulo))}</span>
                </a>`
              : `<a href="index.html" class="episode-nav-card next">
                  <span class="episode-nav-dir">Fin de esta serie →</span>
                  <span class="episode-nav-title">Explorar todo el catálogo de estudios</span>
                </a>`
          }
        </div>
      `;
    }

    if (sidebarNavEl) {
      sidebarNavEl.style.display = 'flex';
      sidebarNavEl.innerHTML = `
        <div class="sidebar-episode-header">
          <span class="lexicon-field-label" style="margin-bottom: 0;">Continuidad de la Serie</span>
          <span class="sidebar-episode-pos">${currentIdx + 1} / ${serieEstudios.length}</span>
        </div>
        <div class="sidebar-episode-links">
          ${
            prevEstudio
              ? `<a href="estudio.html?id=${encodeURIComponent(prevEstudio.id)}" class="sidebar-episode-link">
                  <span class="sidebar-ep-dir">← Anterior (${escapeHtml(prevEstudio.edicion || 'Estudio')})</span>
                  <span class="sidebar-ep-title">${escapeHtml(acortarTitulo(prevEstudio.titulo))}</span>
                </a>`
              : ''
          }
          ${
            nextEstudio
              ? `<a href="estudio.html?id=${encodeURIComponent(nextEstudio.id)}" class="sidebar-episode-link is-next">
                  <span class="sidebar-ep-dir">Siguiente (${escapeHtml(nextEstudio.edicion || 'Estudio')}) →</span>
                  <span class="sidebar-ep-title">${escapeHtml(acortarTitulo(nextEstudio.titulo))}</span>
                </a>`
              : ''
          }
        </div>
      `;
    }
  })();

  // 3. Configurar PDF.js y renderizar todas las páginas en <canvas> con barra de progreso real
  if (!window.pdfjsLib) {
    stageEl.innerHTML = `<p style="color:#E4E2DD; padding:3rem;">Cargando motor de lectura protegido...</p>`;
    return;
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  let pdfDoc = null;
  let zoomFactor = 1.0;
  let currentPage = 1;
  let totalPages = 0;
  let isRendering = false;

  const progressBarEl = document.getElementById('pdf-progress-bar');
  const progressTextEl = document.getElementById('pdf-progress-text');
  const progressDetailEl = document.getElementById('pdf-progress-detail');

  try {
    const loadingTask = window.pdfjsLib.getDocument({
      url: estudio.pdfUrl,
      disableAutoFetch: false,
      disableStream: false
    });

    loadingTask.onProgress = (progressData) => {
      if (!progressData) return;
      const loaded = progressData.loaded || 0;
      const total = progressData.total || 0;

      if (total > 0) {
        const pct = Math.min(100, Math.round((loaded / total) * 100));
        const loadedMb = (loaded / (1024 * 1024)).toFixed(1);
        const totalMb = (total / (1024 * 1024)).toFixed(1);

        if (progressBarEl) {
          progressBarEl.classList.remove('indeterminate');
          progressBarEl.style.width = `${pct}%`;
        }
        if (progressTextEl) {
          progressTextEl.textContent = `Cargando estudio: ${pct}%`;
        }
        if (progressDetailEl) {
          progressDetailEl.textContent = `${loadedMb} MB de ${totalMb} MB · Optimizando pergamino digital...`;
        }
        if (pageIndicatorEl) {
          pageIndicatorEl.textContent = `Cargando ${pct}%...`;
        }
      } else if (loaded > 0) {
        const loadedMb = (loaded / (1024 * 1024)).toFixed(1);
        if (progressTextEl) {
          progressTextEl.textContent = `Descargando estudio (${loadedMb} MB)...`;
        }
        if (pageIndicatorEl) {
          pageIndicatorEl.textContent = `Cargando (${loadedMb} MB)...`;
        }
      }
    };

    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;

    if (progressBarEl) {
      progressBarEl.classList.remove('indeterminate');
      progressBarEl.style.width = '100%';
    }
    if (progressTextEl) {
      progressTextEl.textContent = 'Cargando estudio: 100%';
    }
    if (progressDetailEl) {
      progressDetailEl.textContent = `Documento listo (${totalPages} páginas). Dibujando en alta definición...`;
    }

    actualizarControles();
    await renderizarTodasLasPaginas();
  } catch (err) {
    console.error('Error al renderizar el PDF:', err);
    stageEl.innerHTML = `
      <div style="color:#E4E2DD; text-align:center; padding:3rem; max-width:460px;">
        <p style="font-family:var(--font-serif); font-size:1.4rem; margin-bottom:0.5rem;">No se pudo abrir el documento</p>
        <p style="font-size:0.88rem; color:#A8A49C;">Verifica tu conexión o vuelve al catálogo de estudios.</p>
      </div>
    `;
  }

  async function renderizarTodasLasPaginas() {
    if (!pdfDoc || isRendering) return;
    isRendering = true;
    stageEl.innerHTML = '';

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const stageWidth = Math.max(300, stageEl.clientWidth - 40);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1 });
      const fitScale = (stageWidth / unscaledViewport.width) * zoomFactor;
      const viewport = page.getViewport({ scale: fitScale });

      const pageContainer = document.createElement('div');
      pageContainer.className = 'pdf-page-container';
      pageContainer.dataset.pageNumber = String(pageNum);
      pageContainer.style.width = `${Math.floor(viewport.width)}px`;
      pageContainer.style.scrollMarginTop = '140px';

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      const ctx = canvas.getContext('2d', { alpha: false });

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);

      // Escudo transparente que impide clic derecho o arrastrar el canvas
      const shield = document.createElement('div');
      shield.className = 'pdf-shield-overlay';
      shield.addEventListener('contextmenu', bloquearEvento);
      shield.addEventListener('dragstart', bloquearEvento);

      pageContainer.appendChild(canvas);
      pageContainer.appendChild(shield);
      stageEl.appendChild(pageContainer);

      const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null;
      await page.render({
        canvasContext: ctx,
        transform: transform,
        viewport: viewport
      }).promise;
    }

    isRendering = false;
    actualizarControles();
  }

  function actualizarControles() {
    if (pageIndicatorEl) {
      pageIndicatorEl.textContent = `Pág. ${currentPage} de ${totalPages || 1}`;
    }
    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= totalPages;
    if (zoomLabel) zoomLabel.textContent = `${Math.round(zoomFactor * 100)}%`;
  }

  function irAPagina(num) {
    if (!stageEl) return;
    const target = Math.max(1, Math.min(totalPages, num));
    currentPage = target;
    const pageEl = stageEl.querySelector(`[data-page-number="${target}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    actualizarControles();
  }

  // Detectar página actual al hacer scroll en la ventana
  const detectarPaginaVisible = () => {
    if (!stageEl) return;
    const pages = stageEl.querySelectorAll('.pdf-page-container');
    let bestPage = currentPage;
    const threshold = window.innerHeight * 0.45;

    pages.forEach(p => {
      const rect = p.getBoundingClientRect();
      if (rect.top <= threshold && rect.bottom >= 140) {
        bestPage = Number(p.dataset.pageNumber);
      }
    });

    if (bestPage !== currentPage) {
      currentPage = bestPage;
      actualizarControles();
    }
  };

  window.addEventListener('scroll', detectarPaginaVisible, { passive: true });

  if (btnPrev) {
    btnPrev.addEventListener('click', () => irAPagina(currentPage - 1));
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => irAPagina(currentPage + 1));
  }

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', async () => {
      if (zoomFactor >= 1.6 || isRendering) return;
      zoomFactor = Number((zoomFactor + 0.15).toFixed(2));
      await renderizarTodasLasPaginas();
    });
  }

  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', async () => {
      if (zoomFactor <= 0.7 || isRendering) return;
      zoomFactor = Number((zoomFactor - 0.15).toFixed(2));
      await renderizarTodasLasPaginas();
    });
  }

  if (btnFullscreen && wrapperEl) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        wrapperEl.style.overflowY = 'auto';
        wrapperEl.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }
});


// Renderizado de Infografía Doctrinal, Esquema de Contraste y Axiomas
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const studyId = params.get('id') || 'bautismo';
  const infoSection = document.getElementById('study-infographic-section');
  const tabPdf = document.getElementById('tab-btn-pdf');
  const tabInfo = document.getElementById('tab-btn-infografia');
  const pdfWrapper = document.getElementById('pdf-protected-wrapper');

  if (tabPdf && tabInfo && pdfWrapper && infoSection) {
    tabPdf.addEventListener('click', () => {
      tabPdf.classList.add('active');
      tabInfo.classList.remove('active');
      pdfWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    tabInfo.addEventListener('click', () => {
      tabInfo.classList.add('active');
      tabPdf.classList.remove('active');
      infoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (!infoSection) return;

  try {
    const res = await fetch('data/estudios.json');
    const estudios = await res.json();
    const estudio = estudios.find(s => s.id === studyId || s.slug === studyId) || estudios[0];
    if (!estudio || !estudio.infografia) return;

    const info = estudio.infografia;

    infoSection.innerHTML = `
      <div class="infographic-header">
        <span class="eyebrow">Esquema Doctrinal e Infografía</span>
        <h2>${info.tema_central}</h2>
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 0.35rem; margin-bottom: 1rem;">
          Síntesis teológica visual basada en ${estudio.referencia}
        </p>
        <button type="button" class="btn btn-outline" id="btn-download-infographic-only" style="padding: 0.5rem 1.1rem; font-size: 0.8rem;">
          🖼️ Descargar Lámina de Infografía (Imagen HD)
        </button>
      </div>

      <!-- 1. Flujo / Progresión Teológica -->
      <div class="lexicon-field-label" style="margin-bottom: 0.75rem;">I. Progresión Teológica del Pasaje</div>
      <div class="flow-diagram">
        ${info.flujo
          .map(
            f => `
          <div class="flow-step-card">
            <div class="flow-step-title">${f.paso}</div>
            <p class="flow-step-desc">${f.detalle}</p>
          </div>
        `
          )
          .join('')}
      </div>

      <!-- 2. Cuadro Comparativo de Contraste Doctrinal -->
      <div class="lexicon-field-label" style="margin-bottom: 0.75rem;">II. Contraste Doctrinal (Falso Misticismo vs. Verdad Bíblica)</div>
      <div class="contrast-grid">
        <div class="contrast-col error-col">
          <div class="contrast-col-header">
            <span>✕</span> ${info.contraste.error_titulo}
          </div>
          <ul class="contrast-list">
            ${info.contraste.error_puntos
              .map(p => `<li><span class="contrast-icon">−</span><span>${p}</span></li>`)
              .join('')}
          </ul>
        </div>

        <div class="contrast-col truth-col">
          <div class="contrast-col-header">
            <span>✦</span> ${info.contraste.verdad_titulo}
          </div>
          <ul class="contrast-list">
            ${info.contraste.verdad_puntos
              .map(p => `<li><span class="contrast-icon">✓</span><span>${p}</span></li>`)
              .join('')}
          </ul>
        </div>
      </div>

      <!-- 3. Axiomas Teológicos (Citas para Compartir) -->
      <div class="lexicon-field-label" style="margin-bottom: 0.75rem;">III. Axiomas de «Vianda Sólida» (Para Reflexionar y Compartir)</div>
      <div class="axioms-grid">
        ${info.axiomas
          .map(
            (ax, idx) => `
          <div class="axiom-card">
            <p class="axiom-quote">${ax}</p>
            <div class="axiom-footer">
              <span>Códice Bíblico · Axioma ${idx + 1}</span>
              <button type="button" class="btn-copy-axiom" data-quote="${ax.replace(/"/g, '&quot;')}">
                Copiar Cita
              </button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>

      <!-- 4. Conexión Directa con el Diccionario Exegético Etymos -->
      <div class="etymos-chips-bar">
        <span class="lexicon-field-label" style="margin-bottom: 0;">Raíces en Etymos:</span>
        ${(info.terminos_etymos || [])
          .map(
            t => `
          <a href="etymos.html?q=${encodeURIComponent(t)}" class="etymos-chip">
            📜 Explorar «${t}» en Etymos →
          </a>
        `
          )
          .join('')}
      </div>
    `;

    infoSection.querySelectorAll('.btn-copy-axiom').forEach(btn => {
      btn.addEventListener('click', () => {
        const quote = `${btn.dataset.quote} — Estudio «${estudio.titulo}» (${window.location.href})`;
        navigator.clipboard.writeText(quote).then(() => {
          const prev = btn.textContent;
          btn.textContent = '✓ Copiado';
          setTimeout(() => {
            btn.textContent = prev;
          }, 1800);
        });
      });
    });
  } catch (err) {
    console.error('Error cargando infografía:', err);
  }
});


// ==========================================================================
// GENERADOR DE LÁMINA DE INFOGRAFÍA HD Y FUSIÓN CON EL PDF DEL ESTUDIO
// ==========================================================================
function generarCanvasInfografia(estudio) {
  const info = estudio.infografia;
  const W = 1600;
  const H = 2260;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Helper para texto multilínea
  function drawWrappedText(text, x, y, maxWidth, lineHeight, font, color, align = 'left') {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    const words = String(text || '').split(' ');
    let line = '';
    let curY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line.trim()) {
      ctx.fillText(line.trim(), x, curY);
      curY += lineHeight;
    }
    return curY;
  }

  // 1. Fondo Pergamino Editorial y Marco Doble en Bronce
  ctx.fillStyle = '#FAF8F5';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#9A7B3E';
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  ctx.strokeStyle = '#DECBA4';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(62, 62, W - 124, H - 124);

  // 2. Cabecera Editorial
  ctx.fillStyle = '#9A7B3E';
  ctx.font = 'bold 22px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CÓDICE BÍBLICO  ·  ESQUEMA DOCTRINAL E INFOGRAFÍA', W / 2, 130);

  let nextY = drawWrappedText(
    estudio.titulo,
    W / 2,
    190,
    W - 260,
    52,
    'bold 44px Georgia, serif',
    '#161618',
    'center'
  );

  nextY = drawWrappedText(
    info.tema_central,
    W / 2,
    nextY + 10,
    W - 300,
    38,
    'italic 28px Georgia, serif',
    '#7A5F2B',
    'center'
  );

  ctx.font = '500 22px Inter, sans-serif';
  ctx.fillStyle = '#686870';
  ctx.fillText(`Pasajes Base: ${estudio.referencia}`, W / 2, nextY + 18);

  // Línea divisoria
  const divY = nextY + 50;
  ctx.strokeStyle = '#E6E1D8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(110, divY);
  ctx.lineTo(W - 110, divY);
  ctx.stroke();

  // 3. SECCIÓN I: PROGRESIÓN TEOLÓGICA (3 Columnas)
  let sec1Y = divY + 52;
  ctx.textAlign = 'left';
  ctx.font = 'bold 21px Inter, sans-serif';
  ctx.fillStyle = '#9A7B3E';
  ctx.fillText('I. PROGRESIÓN TEOLÓGICA DEL PASAJE', 110, sec1Y);

  const boxTop = sec1Y + 25;
  const boxW = 438;
  const boxH = 290;
  const gap = 33;

  info.flujo.slice(0, 3).forEach((f, idx) => {
    const bx = 110 + idx * (boxW + gap);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(bx, boxTop, boxW, boxH);
    ctx.strokeStyle = '#DECBA4';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, boxTop, boxW, boxH);

    // Franja superior bronce
    ctx.fillStyle = '#9A7B3E';
    ctx.fillRect(bx, boxTop, boxW, 8);

    const ty = drawWrappedText(
      f.paso,
      bx + 26,
      boxTop + 52,
      boxW - 52,
      34,
      'bold 27px Georgia, serif',
      '#161618',
      'left'
    );

    drawWrappedText(
      f.detalle,
      bx + 26,
      ty + 14,
      boxW - 52,
      32,
      '400 22px Inter, sans-serif',
      '#4A4A50',
      'left'
    );
  });

  // 4. SECCIÓN II: CONTRASTE DOCTRINAL (2 Columnas)
  const sec2Y = boxTop + boxH + 65;
  ctx.textAlign = 'left';
  ctx.font = 'bold 21px Inter, sans-serif';
  ctx.fillStyle = '#9A7B3E';
  ctx.fillText('II. CONTRASTE DOCTRINAL (ERROR RELIGIOSO VS. VERDAD DEL EVANGELIO)', 110, sec2Y);

  const colTop = sec2Y + 25;
  const colW = 670;
  const colH = 560;

  // Columna Izquierda: Error
  ctx.fillStyle = '#FAF5F4';
  ctx.fillRect(110, colTop, colW, colH);
  ctx.strokeStyle = '#E3C9C5';
  ctx.lineWidth = 2;
  ctx.strokeRect(110, colTop, colW, colH);

  let errY = drawWrappedText(
    `✕  ${info.contraste.error_titulo}`,
    142,
    colTop + 52,
    colW - 64,
    36,
    'bold 28px Georgia, serif',
    '#7F2D24',
    'left'
  );
  errY += 18;
  info.contraste.error_puntos.forEach(pt => {
    errY = drawWrappedText(
      `•  ${pt}`,
      142,
      errY,
      colW - 64,
      33,
      '400 22px Inter, sans-serif',
      '#4A4A50',
      'left'
    );
    errY += 20;
  });

  // Columna Derecha: Verdad
  const rightX = 110 + colW + 40;
  ctx.fillStyle = '#F7F2E7';
  ctx.fillRect(rightX, colTop, colW, colH);
  ctx.strokeStyle = '#DECBA4';
  ctx.lineWidth = 2;
  ctx.strokeRect(rightX, colTop, colW, colH);

  let trY = drawWrappedText(
    `✦  ${info.contraste.verdad_titulo}`,
    rightX + 32,
    colTop + 52,
    colW - 64,
    36,
    'bold 28px Georgia, serif',
    '#7A5F2B',
    'left'
  );
  trY += 18;
  info.contraste.verdad_puntos.forEach(pt => {
    trY = drawWrappedText(
      `✓  ${pt}`,
      rightX + 32,
      trY,
      colW - 64,
      33,
      '400 22px Inter, sans-serif',
      '#2B2B30',
      'left'
    );
    trY += 20;
  });

  // 5. SECCIÓN III: AXIOMAS DE VIANDA SÓLIDA
  const sec3Y = colTop + colH + 65;
  ctx.textAlign = 'left';
  ctx.font = 'bold 21px Inter, sans-serif';
  ctx.fillStyle = '#9A7B3E';
  ctx.fillText('III. AXIOMAS TEOLÓGICOS DE «VIANDA SÓLIDA»', 110, sec3Y);

  let axY = sec3Y + 25;
  info.axiomas.slice(0, 3).forEach((ax, idx) => {
    const cardH = 148;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(110, axY, W - 220, cardH);
    ctx.strokeStyle = '#D1C9BC';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(110, axY, W - 220, cardH);

    ctx.fillStyle = '#9A7B3E';
    ctx.fillRect(110, axY, 8, cardH);

    drawWrappedText(
      `Axioma ${idx + 1}:  ${ax}`,
      142,
      axY + 52,
      W - 284,
      34,
      'italic 24px Georgia, serif',
      '#161618',
      'left'
    );
    axY += cardH + 22;
  });

  // 6. Pie de Lámina
  ctx.textAlign = 'center';
  ctx.font = 'italic 26px Georgia, serif';
  ctx.fillStyle = '#7A5F2B';
  ctx.fillText('Códice Bíblico  ·  Soli Deo Gloria  ·  codicebiblico.netlify.app', W / 2, H - 85);

  return canvas;
}

// Lógica del Botón "Descargar PDF + Infografía" y Modal de Benefactor (estudio.html)
document.addEventListener('DOMContentLoaded', async () => {
  const btnDownload = document.getElementById('btn-download-pdf');
  const modalBackdrop = document.getElementById('download-modal-backdrop');
  const modalClose = document.getElementById('download-modal-close');
  const unlockForm = document.getElementById('benefactor-unlock-form');
  const emailInput = document.getElementById('benefactor-email');
  const codeInput = document.getElementById('benefactor-code');
  const errorMsg = document.getElementById('benefactor-error');

  if (!btnDownload) return;

  const params = new URLSearchParams(window.location.search);
  const studyId = params.get('id') || 'bautismo';
  let estudioActual = null;
  let modoDescargaPendiente = 'completo'; // 'completo' | 'lamina'

  try {
    const res = await fetch('data/estudios.json');
    const estudios = await res.json();
    estudioActual = estudios.find(s => s.id === studyId || s.slug === studyId) || estudios[0];
  } catch (e) {
    console.error(e);
  }

  function actualizarEstadoBoton() {
    if (window.CodiceBenefactor && window.CodiceBenefactor.estaDesbloqueado()) {
      btnDownload.innerHTML = '📥 Descargar PDF + Infografía (Habilitado)';
      btnDownload.style.borderColor = 'var(--accent-bronze)';
      btnDownload.style.color = 'var(--accent-bronze-dark)';
    }
  }

  async function descargarLaminaInfografia() {
    if (!estudioActual || !estudioActual.infografia) return;
    const canvas = generarCanvasInfografia(estudioActual);
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Infografia-Codice-Biblico-${estudioActual.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function dispararDescargaCompleta() {
    if (!estudioActual || !estudioActual.pdfUrl) return;
    const prevLabel = btnDownload.innerHTML;
    btnDownload.innerHTML = '⏳ Preparando PDF + Infografía...';
    btnDownload.disabled = true;

    try {
      if (window.PDFLib && estudioActual.infografia) {
        const pdfBytes = await fetch(estudioActual.pdfUrl).then(r => r.arrayBuffer());
        const pdfDoc = await window.PDFLib.PDFDocument.load(pdfBytes);

        // Generar la lámina de infografía y añadirla como última página del PDF
        const canvas = generarCanvasInfografia(estudioActual);
        const pngDataUrl = canvas.toDataURL('image/png');
        const pngImage = await pdfDoc.embedPng(pngDataUrl);

        // Usar el mismo ancho que la primera página del PDF para consistencia visual
        const firstPage = pdfDoc.getPages()[0];
        const { width: refW } = firstPage ? firstPage.getSize() : { width: 595.28 };
        const infoHeight = (refW * canvas.height) / canvas.width;

        const infoPage = pdfDoc.addPage([refW, infoHeight]);
        infoPage.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: refW,
          height: infoHeight
        });

        const mergedBytes = await pdfDoc.save();
        const blob = new Blob([mergedBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `Codice-Biblico-${estudioActual.id}-con-Infografia.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        const a = document.createElement('a');
        a.href = estudioActual.pdfUrl;
        a.download = `Codice-Biblico-${estudioActual.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      console.error('Error fusionando PDF e infografía:', err);
      const a = document.createElement('a');
      a.href = estudioActual.pdfUrl;
      a.download = `Codice-Biblico-${estudioActual.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      btnDownload.disabled = false;
      actualizarEstadoBoton();
      if (!(window.CodiceBenefactor && window.CodiceBenefactor.estaDesbloqueado())) {
        btnDownload.innerHTML = prevLabel;
      }
    }
  }

  actualizarEstadoBoton();

  btnDownload.addEventListener('click', () => {
    modoDescargaPendiente = 'completo';
    if (window.CodiceBenefactor && window.CodiceBenefactor.estaDesbloqueado()) {
      dispararDescargaCompleta();
    } else if (modalBackdrop) {
      if (errorMsg) errorMsg.style.display = 'none';
      modalBackdrop.classList.add('open');
    }
  });

  // Delegación para el botón "Descargar Lámina de Infografía (Imagen HD)"
  document.addEventListener('click', (e) => {
    const target = e.target.closest('#btn-download-infographic-only');
    if (!target) return;
    modoDescargaPendiente = 'lamina';
    if (window.CodiceBenefactor && window.CodiceBenefactor.estaDesbloqueado()) {
      descargarLaminaInfografia();
    } else if (modalBackdrop) {
      if (errorMsg) errorMsg.style.display = 'none';
      modalBackdrop.classList.add('open');
    }
  });

  if (modalClose && modalBackdrop) {
    modalClose.addEventListener('click', () => modalBackdrop.classList.remove('open'));
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) modalBackdrop.classList.remove('open');
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
        if (modalBackdrop) modalBackdrop.classList.remove('open');
        actualizarEstadoBoton();
        if (modoDescargaPendiente === 'lamina') {
          await descargarLaminaInfografia();
        } else {
          await dispararDescargaCompleta();
        }
      } else if (errorMsg) {
        errorMsg.style.display = 'block';
      }
    });
  }
});
