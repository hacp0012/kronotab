import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'public', 'dictionaries');

fs.mkdirSync(outDir, { recursive: true });

const pairs = [
  { lang: 'fr', pkg: 'dictionary-fr' },
  { lang: 'en', pkg: 'dictionary-en' },
];

for (const { lang, pkg } of pairs) {
  const srcDir = path.join(rootDir, 'node_modules', pkg);
  for (const ext of ['aff', 'dic']) {
    const src = path.join(srcDir, `index.${ext}`);
    const dest = path.join(outDir, `${lang}.${ext}`);
    if (!fs.existsSync(src)) {
      throw new Error(`Dictionnaire introuvable : ${src}`);
    }
    fs.copyFileSync(src, dest);
  }
}

console.log('Dictionnaires FR et EN copiés dans public/dictionaries/');
