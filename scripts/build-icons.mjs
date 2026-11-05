// Generiert PNG-Icons aus public/icons/icon.svg (Quell-ViewBox: 1080x1080).
// Aufruf: npm run icons
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(here, '..', 'public', 'icons');
const svg = await readFile(path.join(iconsDir, 'icon.svg'));

// 16–128 für manifest.json, 512 für die Addon-Liste (addons.mozilla.org)
for (const size of [16, 32, 48, 64, 128, 512]) {
  const file = path.join(iconsDir, `icon-${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(file);
  console.log(`icons/icon-${size}.png geschrieben`);
}
