const fs = require('fs');
const path = require('path');

console.log('📦 Empaquetando Códice Bíblico — Biblioteca Teológica Web (Edición Minimalista)...\n');

const rootDir = __dirname;
const distPath = path.join(rootDir, 'dist');

const htmlFiles = ['index.html', 'estudio.html', 'etymos.html', 'nosotros.html'];
const foldersToCopy = ['css', 'js', 'assets'];
const dataFilesToCopy = ['estudios.json', 'etymos.json'];

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

  console.log('\n✅ Empaquetado finalizado con éxito en ./dist');
} catch (error) {
  console.error('❌ Error durante el empaquetado:', error);
  process.exit(1);
}
