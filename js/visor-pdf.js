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
  let estudio = null;
  try {
    const res = await fetch('data/estudios.json');
    const estudios = await res.json();
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

  // 3. Configurar PDF.js y renderizar todas las páginas en <canvas>
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

  try {
    const loadingTask = window.pdfjsLib.getDocument({
      url: estudio.pdfUrl,
      disableAutoFetch: false,
      disableStream: false
    });

    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;
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
  const btnShare = document.getElementById('btn-share-study');
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

  if (btnShare) {
    btnShare.addEventListener('click', () => {
      const shareUrl = window.location.href;
      navigator.clipboard.writeText(shareUrl).then(() => {
        const prev = btnShare.textContent;
        btnShare.textContent = '✓ Enlace copiado';
        setTimeout(() => {
          btnShare.textContent = prev;
        }, 2000);
      });
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
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 0.35rem;">
          Síntesis teológica visual basada en ${estudio.referencia}
        </p>
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
