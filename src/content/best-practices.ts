/**
 * Best-Practices-Checks (Content-Script): eigene DOM-/Timing-Checks.
 * Liefert nur sprachneutrale Findings (Status, Messwert, Belege); Texte, Gewichte und die
 * Bewertung der ratio-Checks kommen aus dem Scoring im Background.
 *
 * Quellen (je Check):
 * - HTTPS: https://developer.mozilla.org/docs/Web/Security/Secure_Contexts
 * - Viewport: https://developer.mozilla.org/docs/Web/HTML/Viewport_meta_tag
 * - Quirks-Modus: https://developer.mozilla.org/docs/Web/HTML/Quirks_Mode_and_Standards_Mode
 * - Mixed Content: https://developer.mozilla.org/docs/Web/Security/Mixed_content
 * - Charset: https://developer.mozilla.org/docs/Web/HTML/Element/meta#charset
 * - Veraltete Elemente: https://developer.mozilla.org/docs/Web/HTML/Element#obsolete_and_deprecated_elements
 * - noopener: https://developer.mozilla.org/docs/Web/HTML/Attributes/rel/noopener
 * - Bildformate: https://web.dev/articles/image-formats
 * - nextHopProtocol: https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/nextHopProtocol
 */

import type { BpFinding } from '../shared/types';

const DEPRECATED = [
  'center', 'font', 'marquee', 'big', 'strike', 'tt', 'acronym', 'applet', 'basefont', 'dir', 'noframes',
  '[bgcolor]', '[background]', '[align]', '[valign]', '[hspace]', '[vspace]', '[border]:not(table)',
];
const MIXED_CONTENT = ['script[src', 'img[src', 'iframe[src', 'link[href', 'video[src', 'audio[src', 'source[src', 'embed[src', 'object[data']
  .map((selector) => `${selector}^="http:"]`)
  .join(',');
const MODERN_IMAGE = /\.(webp|avif|svg)$/i;
const MAX_ITEMS = 10;

function finding(id: string, level: BpFinding['level'], value: string | number | null = null, items: string[] = [], ratio: number | null = null): BpFinding {
  return { id, level, ratio, value: value == null ? null : String(value), items: items.slice(0, MAX_ITEMS) };
}

const passIf = (ok: boolean) => (ok ? 'pass' : 'fail');

export function collectBestPractices(): BpFinding[] {
  const isHttps = location.protocol === 'https:';
  const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? null;
  const mixed = isHttps ? Array.from(document.querySelectorAll(MIXED_CONTENT)) : [];
  const deprecated = DEPRECATED.map((selector) => [selector, document.querySelectorAll(selector).length] as const).filter(([, n]) => n > 0);
  const unsafeBlank = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]:not([rel~="noopener"]):not([rel~="noreferrer"])'),
  ).filter((anchor) => anchor.origin !== location.origin);

  // Bilder: Legacy-Anteil an den (per Resource Timing bekannten) Bild-Bytes + verzerrte Darstellung
  const images = Array.from(document.images).filter((img) => img.complete && img.naturalWidth > 0);
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const bytesByUrl = new Map(resources.map((entry) => [entry.name, entry.transferSize || entry.encodedBodySize]));
  let imageBytes = 0;
  let legacyBytes = 0;
  const legacyImages: string[] = [];
  for (const img of images) {
    const bytes = bytesByUrl.get(img.currentSrc) ?? 0;
    if (!bytes) continue;
    imageBytes += bytes;
    if (!MODERN_IMAGE.test(new URL(img.currentSrc).pathname)) {
      legacyBytes += bytes;
      legacyImages.push(img.currentSrc);
    }
  }
  const distorted = images.filter((img) => {
    if (img.clientWidth < 24 || img.clientHeight < 24) return false;
    return Math.abs(img.clientWidth / img.clientHeight / (img.naturalWidth / img.naturalHeight) - 1) > 0.1;
  });

  // Protokolle der same-origin-Ressourcen
  const sameOrigin = [...performance.getEntriesByType('navigation'), ...resources]
    .map((entry) => entry as PerformanceResourceTiming)
    .filter((entry) => entry.nextHopProtocol && new URL(entry.name).origin === location.origin);
  const protocols = new Map<string, number>();
  for (const entry of sameOrigin) protocols.set(entry.nextHopProtocol, (protocols.get(entry.nextHopProtocol) ?? 0) + 1);
  const legacyProtocol = sameOrigin.filter((entry) => !/^h[23]/.test(entry.nextHopProtocol)).length;

  return [
    finding('https', passIf(isHttps), location.protocol),
    finding('viewport', passIf(viewport?.includes('width=device-width') ?? false), viewport),
    finding('quirks-mode', passIf(document.compatMode !== 'BackCompat'), document.compatMode),
    finding('mixed-content', isHttps ? passIf(mixed.length === 0) : 'na', mixed.length,
      mixed.map((el) => `<${el.tagName.toLowerCase()}> ${el.getAttribute('src') ?? el.getAttribute('href') ?? el.getAttribute('data')}`)),
    finding('charset', passIf(document.querySelector('meta[charset], meta[http-equiv="Content-Type" i]') != null), document.characterSet),
    finding('deprecated-html', passIf(deprecated.length === 0), deprecated.reduce((sum, [, n]) => sum + n, 0),
      deprecated.map(([selector, n]) => `${selector} ×${n}`)),
    finding('anchor-noopener', passIf(unsafeBlank.length === 0), unsafeBlank.length, unsafeBlank.map((anchor) => anchor.href)),
    imageBytes
      ? finding('image-formats', null, `${Math.round((legacyBytes / imageBytes) * 100)} %`, legacyImages, legacyBytes / imageBytes)
      : finding('image-formats', 'na'),
    images.length
      ? finding('image-aspect-ratio', passIf(distorted.length === 0), `${distorted.length} / ${images.length}`,
        distorted.map((img) => `${img.naturalWidth}×${img.naturalHeight} → ${img.clientWidth}×${img.clientHeight} ${img.currentSrc}`))
      : finding('image-aspect-ratio', 'na'),
    sameOrigin.length
      ? finding('http2', null, Array.from(protocols, ([protocol, n]) => `${protocol} ×${n}`).join(', '), [], legacyProtocol / sameOrigin.length)
      : finding('http2', 'na'),
  ];
}
