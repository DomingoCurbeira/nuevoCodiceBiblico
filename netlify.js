const fs = require('fs');
const path = require('path');

console.log('📦 Empaquetando Códice Bíblico — Biblioteca Teológica Web (Edición Minimalista)...\n');

const rootDir = __dirname;
const distPath = path.join(rootDir, 'dist');
const SITE_URL = (process.env.URL || 'https://codicebiblico.netlify.app').replace(/\/$/, '');

const htmlFiles = ['index.html', 'estudio.html', 'panorama.html', 'genealogia.html', 'etymos.html', 'nosotros.html'];
const foldersToCopy = ['css', 'js', 'assets'];
const dataFilesToCopy = ['estudios.json', 'etymos.json', 'libros.json', 'genealogia.json'];

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildStudySharePage(estudio) {
  const safeId = encodeURIComponent(estudio.id);
  const targetRelative = `../../estudio.html?id=${safeId}`;
  const shareUrl = `${SITE_URL}/estudios/${safeId}/`;
  const coverPath = String(estudio.portada || 'assets/sello.png').replace(/^\/+/, '');
  const imageUrl = `${SITE_URL}/${coverPath}`;
  const isWebp = coverPath.toLowerCase().endsWith('.webp');
  const imageType = isWebp ? 'image/webp' : coverPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const ogTitle = `${estudio.titulo} | Códice Bíblico`;
  const rawDesc = `${estudio.serie}${estudio.edicion ? ' · ' + estudio.edicion : ''} — ${estudio.subtitulo || estudio.referencia || 'Estudio teológico en Códice Bíblico.'}`;
  const ogDesc = rawDesc.length > 240 ? `${rawDesc.slice(0, 237)}...` : rawDesc;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(ogTitle)}</title>
  <meta name="description" content="${escapeHtml(ogDesc)}">
  <link rel="canonical" href="${escapeHtml(shareUrl)}">
  <link rel="icon" type="image/png" href="../../assets/sello.png">

  <!-- Open Graph / WhatsApp / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:locale" content="es_ES">
  <meta property="og:site_name" content="Códice Bíblico">
  <meta property="og:url" content="${escapeHtml(shareUrl)}">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDesc)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:type" content="${imageType}">
  <meta property="og:image:width" content="720">
  <meta property="og:image:height" content="720">
  <meta property="og:image:alt" content="${escapeHtml(estudio.titulo)}">

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDesc)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">

  <script>
    window.location.replace(${JSON.stringify(targetRelative)});
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${escapeHtml(targetRelative)}">
  </noscript>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #FAF8F5;
      color: #1A1A1D;
      font-family: Georgia, serif;
      text-align: center;
      padding: 2rem;
    }
    a {
      color: #8A6B32;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main>
    <p>Abriendo <strong>${escapeHtml(estudio.titulo)}</strong> en Códice Bíblico…</p>
    <p><a href="${escapeHtml(targetRelative)}">Haz clic aquí si no redirige automáticamente</a></p>
  </main>
</body>
</html>
`;
}

try {
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
  }
  fs.mkdirSync(distPath, { recursive: true });

  // 1. Copiar páginas HTML principales
  for (const file of htmlFiles) {
    const src = path.join(rootDir, file);
    const dest = path.join(distPath, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`📄 Copiado: ${file}`);
    }
  }

  // 2. Copiar carpetas modulares (css, js, assets con portadas y PDFs)
  for (const folder of foldersToCopy) {
    const src = path.join(rootDir, folder);
    const dest = path.join(distPath, folder);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true });
      console.log(`📂 Carpeta copiada: ${folder}/`);
    }
  }

  // 3. Copiar únicamente los JSON limpios de la nueva biblioteca
  const distDataDir = path.join(distPath, 'data');
  fs.mkdirSync(distDataDir, { recursive: true });
  for (const dataFile of dataFilesToCopy) {
    const src = path.join(rootDir, 'data', dataFile);
    const dest = path.join(distDataDir, dataFile);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`📚 Datos copiados: data/${dataFile}`);
    }
  }

  // 4. Generar páginas estáticas Open Graph por estudio (dist/estudios/<id>/index.html)
  // Permite que WhatsApp, Facebook y X muestren la portada y el título exacto de cada estudio
  const estudiosJsonPath = path.join(rootDir, 'data', 'estudios.json');
  if (fs.existsSync(estudiosJsonPath)) {
    const estudios = JSON.parse(fs.readFileSync(estudiosJsonPath, 'utf8'));
    const shareRootDir = path.join(distPath, 'estudios');
    fs.mkdirSync(shareRootDir, { recursive: true });

    let ogCount = 0;
    for (const estudio of estudios) {
      if (!estudio || !estudio.id) continue;
      const studyDir = path.join(shareRootDir, estudio.id);
      fs.mkdirSync(studyDir, { recursive: true });
      fs.writeFileSync(path.join(studyDir, 'index.html'), buildStudySharePage(estudio), 'utf8');
      ogCount++;
    }
    console.log(`🔗 Generadas ${ogCount} tarjetas Open Graph en dist/estudios/<id>/index.html`);
  }

  console.log('\n✅ Empaquetado finalizado con éxito en ./dist');
} catch (error) {
  console.error('❌ Error durante el empaquetado:', error);
  process.exit(1);
}
