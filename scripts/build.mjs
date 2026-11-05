/**
 * Lightfox-Build (esbuild): drei unabhängige IIFE-Bundles nach dist/
 * (keine ES-Module – Firefox MV3 Content-Scripts/Event-Pages laufen als klassische Scripts),
 * dazu public/ (manifest, popup.html/css, icons) und axe-core (axe.min.js) 1:1 kopiert.
 *
 *   npm run build              einmal bauen (dist/ wird in-place überschrieben)
 *   npm run build -- --clean   dist/ vorher löschen
 *   npm run dev                watch-Modus (für web-ext run)
 *
 * In-place statt Löschen: Temporäre Add-ons lesen live von der Platte – ein leeres
 * dist/ während des Builds führt zu „Unable to load script: moz-extension://…/content.js“.
 */

import { cpSync, rmSync } from 'node:fs';
import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
if (process.argv.includes('--clean')) rmSync('dist', { recursive: true, force: true });

cpSync('public', 'dist', { recursive: true });
// axe-core unverändert ausliefern: setzt beim Injizieren selbst window.axe.
cpSync('node_modules/axe-core/axe.min.js', 'dist/axe.min.js');

const options = {
  entryPoints: {
    background: 'src/background/main.ts',
    content: 'src/content/main.ts',
    popup: 'src/popup/main.ts',
  },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'firefox115',
  minify: true,
  logLevel: 'info',
};

if (watch) {
  await (await esbuild.context(options)).watch();
} else {
  await esbuild.build(options);
}
