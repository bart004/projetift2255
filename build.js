// Produit dist/planification.html : un seul fichier, ouvrable par double-clic, sans serveur.
// La source reste src/ : rien n'est dupliqué à la main.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const { outputFiles } = await build({
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', target: 'es2022', write: false,
});
const js = outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('index.html', 'utf8');
const balise = '<script type="module" src="/src/main.js"></script>';
if (!html.includes(balise)) throw new Error('Balise script introuvable dans index.html');
mkdirSync('dist', { recursive: true });
writeFileSync('dist/planification.html', html.replace(balise, () => `<script>\n${js}</script>`));
console.log('dist/planification.html');
