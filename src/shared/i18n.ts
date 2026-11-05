/**
 * Mehrsprachigkeit: Englisch (Standard) und Deutsch.
 * Alle sichtbaren Texte von Report und Popup; das Content-Script liefert nur sprachneutrale Daten.
 * Platzhalter: {name}. Fehlt ein Schlüssel in `de`, meldet TypeScript das beim Typecheck.
 */

export type Lang = 'en' | 'de';
export const LANGS: Lang[] = ['en', 'de'];

const en = {
  // Popup
  'popup.close': 'Close panel',
  'popup.rerun': 'Run again',
  'popup.rerunTitle': 'Reload the page and analyze again',
  'popup.export': 'Export JSON',
  'popup.exportTitle': 'Download report as JSON',
  'popup.loading': 'Running audit … the page is reloaded and analyzed.',
  'popup.errorTitle': 'Audit not possible',
  'popup.retry': 'Try again',
  'popup.auditMeta': 'Audit {time} · {ms} ms',
  'popup.overall': 'Overall',
  'popup.notRated': 'not rated',
  // Fehler
  'error.notHttp': 'This page cannot be analyzed – Lightfox only works on http(s) pages.',
  'error.inject': 'The scripts could not be injected (protected or unsupported page).',
  'error.noResult': 'No result from the page – please run again.',
  'error.unexpected': 'Unexpected error: {message}',
  'error.noTab': 'No active tab found.',
  // Kategorien
  'category.performance': 'Performance',
  'category.accessibility': 'Accessibility',
  'category.best-practices': 'Best Practices',
  'summary.metrics': '{passing} of {total} metrics in the green',
  'summary.checks': '{passing} of {total} checks passed',
  'summary.a11y': '{rules} rules checked · {passed} passed · {violated} violated',
  'summary.unavailable': 'Not available',
  // Allgemein
  'audit.thresholds': 'Thresholds: good ≤ {good}, poor ≥ {poor}.',
  'audit.ratioThresholds': 'Thresholds: share ≤ {good} % good, ≥ {poor} % poor.',
  'audit.notRated': 'Not rated: {reason}',
  'reason.perf': 'no data (not supported by this browser or not measured yet).',
  'reason.bp': 'not applicable on this page.',
  // Barrierefreiheit
  'a11y.value': '{count} element(s) · impact: {impact}',
  'a11y.desc': 'Violated axe rule “{id}” ({wcag}). Found automatically – manual review recommended.',
  'a11y.bestPractice': 'best practice',
  'a11y.unavailableTitle': 'axe-core check',
  'a11y.unavailable': 'The automated accessibility check is not available: {error}',
  // Performance-Audits
  'ttfb.title': 'Server response time (TTFB)',
  'ttfb.desc': 'Time until the first byte of the HTML response (Navigation Timing: responseStart).',
  'lcp.title': 'Largest Contentful Paint (LCP)',
  'lcp.desc': 'When the largest visible content in the viewport was rendered (Core Web Vital).',
  'loadTime.title': 'Load time (load event)',
  'loadTime.desc': 'Time from navigation start until the page has fully loaded (loadEventEnd).',
  'transferBytes.title': 'Transferred data',
  'transferBytes.desc': 'Transferred bytes of the document and its resources (as far as measurable via Resource Timing).',
  'resourceCount.title': 'Number of resources',
  'resourceCount.desc': 'Number of subresources recorded via Resource Timing.',
  'domNodeCount.title': 'DOM size (nodes)',
  'domNodeCount.desc': 'Number of DOM nodes. Large DOMs increase layout, style and memory costs.',
  // Best-Practice-Audits
  'https.title': 'HTTPS',
  'https.desc': 'The page is served exclusively over HTTPS.',
  'viewport.title': 'Meta viewport',
  'viewport.desc': 'A <meta name="viewport"> with width=device-width controls rendering on mobile devices.',
  'quirks-mode.title': 'Standards mode',
  'quirks-mode.desc': 'The page renders in standards mode, not in quirks mode (DOCTYPE present).',
  'mixed-content.title': 'No mixed content',
  'mixed-content.desc': 'HTTPS pages must not load subresources over insecure http://.',
  'charset.title': 'Character encoding declared',
  'charset.desc': 'The character encoding (UTF-8) should be declared in the HTML.',
  'deprecated-html.title': 'No obsolete HTML elements/attributes',
  'deprecated-html.desc': 'Elements like <font> or <center> and attributes like bgcolor are obsolete.',
  'anchor-noopener.title': 'target="_blank" with rel="noopener"',
  'anchor-noopener.desc': 'External links with target="_blank" should set rel="noopener".',
  'image-formats.title': 'Modern image formats',
  'image-formats.desc': 'Share of image bytes in legacy formats (JPEG/PNG/GIF instead of WebP/AVIF/SVG), detected by file extension.',
  'image-aspect-ratio.title': 'Correct image aspect ratios',
  'image-aspect-ratio.desc': 'Images whose displayed ratio deviates by more than 10 % from the natural one (may be intended with object-fit).',
  'http2.title': 'Modern transfer protocol',
  'http2.desc': 'Share of same-origin resources not served via HTTP/2 or HTTP/3.',
};

export type MessageKey = keyof typeof en;

const de: Record<MessageKey, string> = {
  'popup.close': 'Panel schließen',
  'popup.rerun': 'Neu ausführen',
  'popup.rerunTitle': 'Seite neu laden und erneut analysieren',
  'popup.export': 'JSON exportieren',
  'popup.exportTitle': 'Report als JSON herunterladen',
  'popup.loading': 'Audit läuft … die Seite wird neu geladen und analysiert.',
  'popup.errorTitle': 'Audit nicht möglich',
  'popup.retry': 'Erneut versuchen',
  'popup.auditMeta': 'Audit {time} · {ms} ms',
  'popup.overall': 'Gesamt',
  'popup.notRated': 'nicht bewertbar',
  'error.notHttp': 'Diese Seite kann nicht analysiert werden – Lightfox funktioniert nur auf http(s)-Seiten.',
  'error.inject': 'Die Scripte konnten nicht injiziert werden (geschützte oder nicht unterstützte Seite).',
  'error.noResult': 'Kein Ergebnis von der Seite – bitte neu ausführen.',
  'error.unexpected': 'Unerwarteter Fehler: {message}',
  'error.noTab': 'Kein aktiver Tab gefunden.',
  'category.performance': 'Performance',
  'category.accessibility': 'Barrierefreiheit',
  'category.best-practices': 'Best Practices',
  'summary.metrics': '{passing} von {total} Metriken im grünen Bereich',
  'summary.checks': '{passing} von {total} Checks bestanden',
  'summary.a11y': '{rules} Regeln geprüft · {passed} bestanden · {violated} verletzt',
  'summary.unavailable': 'Nicht verfügbar',
  'audit.thresholds': 'Schwellwerte: gut ≤ {good}, schlecht ≥ {poor}.',
  'audit.ratioThresholds': 'Schwellwerte: Anteil ≤ {good} % gut, ≥ {poor} % schlecht.',
  'audit.notRated': 'Nicht bewertet: {reason}',
  'reason.perf': 'keine Daten (vom Browser nicht unterstützt oder noch nicht gemessen).',
  'reason.bp': 'auf dieser Seite nicht anwendbar.',
  'a11y.value': '{count} Element(e) · Impact: {impact}',
  'a11y.desc': 'Verletzte axe-Regel „{id}“ ({wcag}). Automatisch gefunden – manuelle Prüfung empfohlen.',
  'a11y.bestPractice': 'Best Practice',
  'a11y.unavailableTitle': 'axe-core-Prüfung',
  'a11y.unavailable': 'Die automatisierte Barrierefreiheits-Prüfung steht nicht zur Verfügung: {error}',
  'ttfb.title': 'Server-Antwortzeit (TTFB)',
  'ttfb.desc': 'Zeit bis zum ersten Byte der HTML-Antwort (Navigation Timing: responseStart).',
  'lcp.title': 'Largest Contentful Paint (LCP)',
  'lcp.desc': 'Zeitpunkt, an dem der größte sichtbare Inhalt im Viewport gerendert wurde (Core Web Vital).',
  'loadTime.title': 'Ladezeit (load-Event)',
  'loadTime.desc': 'Zeit vom Navigationsstart bis zum vollständigen Laden der Seite (loadEventEnd).',
  'transferBytes.title': 'Übertragene Datenmenge',
  'transferBytes.desc': 'Übertragene Bytes von Dokument und Ressourcen (soweit per Resource Timing messbar).',
  'resourceCount.title': 'Anzahl Ressourcen',
  'resourceCount.desc': 'Anzahl der über Resource Timing erfassten Unterressourcen.',
  'domNodeCount.title': 'DOM-Größe (Knoten)',
  'domNodeCount.desc': 'Anzahl der DOM-Knoten. Große DOMs erhöhen Layout-, Stil- und Speicherkosten.',
  'https.title': 'HTTPS',
  'https.desc': 'Die Seite wird ausschließlich über HTTPS ausgeliefert.',
  'viewport.title': 'Meta-Viewport',
  'viewport.desc': 'Ein <meta name="viewport"> mit width=device-width steuert die Darstellung auf Mobilgeräten.',
  'quirks-mode.title': 'Standardkonformer Modus',
  'quirks-mode.desc': 'Die Seite rendert im Standardmodus, nicht im Quirks-Modus (DOCTYPE vorhanden).',
  'mixed-content.title': 'Keine Mixed-Content-Ressourcen',
  'mixed-content.desc': 'Auf HTTPS-Seiten dürfen keine Unterressourcen über unsicheres http:// geladen werden.',
  'charset.title': 'Zeichencodierung deklariert',
  'charset.desc': 'Die Zeichencodierung (UTF-8) sollte im HTML deklariert sein.',
  'deprecated-html.title': 'Keine veralteten HTML-Elemente/Attribute',
  'deprecated-html.desc': 'Elemente wie <font> oder <center> und Attribute wie bgcolor sind obsolet.',
  'anchor-noopener.title': 'target="_blank" mit rel="noopener"',
  'anchor-noopener.desc': 'Externe Links mit target="_blank" sollten rel="noopener" setzen.',
  'image-formats.title': 'Moderne Bildformate',
  'image-formats.desc': 'Anteil der Bild-Bytes in Legacy-Formaten (JPEG/PNG/GIF statt WebP/AVIF/SVG), ermittelt per Dateiendung.',
  'image-aspect-ratio.title': 'Bild-Seitenverhältnisse korrekt',
  'image-aspect-ratio.desc': 'Bilder, deren dargestelltes Verhältnis um mehr als 10 % vom natürlichen abweicht (bei object-fit ggf. gewollt).',
  'http2.title': 'Modernes Übertragungsprotokoll',
  'http2.desc': 'Anteil der same-origin-Ressourcen, die nicht per HTTP/2 oder HTTP/3 ausgeliefert werden.',
};

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, de };

export function t(lang: Lang, key: MessageKey, params: Record<string, string | number> = {}): string {
  return MESSAGES[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

/** Titel + Beschreibung eines Audits (Schlüssel `<id>.title` / `<id>.desc`). */
export function auditText(lang: Lang, id: string): { title: string; description: string } {
  return { title: t(lang, `${id}.title` as MessageKey), description: t(lang, `${id}.desc` as MessageKey) };
}
