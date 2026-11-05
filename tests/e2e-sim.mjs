/**
 * End-to-End-Simulation mit den ECHTEN dist/-Bundles (kein Firefox nötig):
 *
 *   dist/popup.js (jsdom)  ──GET_REPORT──►  dist/background.js (Funktion)
 *        ▲                                       │ reload → inject → RUN_AUDIT
 *        │                                       ▼
 *   dist/content.js (jsdom, echte Seite)  +  dist/axe.js (echtes axe-core)
 *
 * Simuliert Firefox-Semantik: Listener-Promises, tabs.reload (frisches Dokument +
 * onUpdated loading/complete), scripting.executeScript mit files (content.js,
 * axe.min.js) und mit func (serialisiert, Promise-Ergebnis wird abgewartet).
 * Läuft gegen `dist/` – vorher also `npm run build` ausführen.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(root, 'dist');
const read = (file) => readFileSync(resolve(distDir, file), 'utf8');

const pageUrl = 'https://example.com/test';
const tabId = 1;

const badPage = `<!DOCTYPE html>
<html lang="de">
<head><title>E2E Sim</title></head>
<body>
  <img src="https://example.com/hero.jpg">
  <input type="text" id="search">
  <a href="https://external.example.org/" target="_blank">Extern</a>
</body>
</html>`;

// --- Nachrichten-Bus (Firefox-artige Semantik) ------------------------------
function makeBus() {
  const listeners = new Set();
  return {
    addListener(listener) {
      listeners.add(listener);
    },
    removeListener(listener) {
      listeners.delete(listener);
    },
    async deliver(...args) {
      const callArgs = args.length > 1 ? args : [args[0], { tab: { id: tabId } }, () => {}];
      for (const listener of [...listeners]) {
        const result = await listener(...callArgs);
        if (result !== undefined) return result;
      }
      return undefined;
    },
    get size() {
      return listeners.size;
    },
  };
}

const popupToBackground = makeBus(); // runtime.onMessage im Background
const tabUpdated = makeBus(); // tabs.onUpdated im Background

// --- Simulierte Seite --------------------------------------------------------
// runScripts: 'outside-only' nötig, damit window.eval im Fenster-Realm läuft.
// Jedes (Neu-)Laden erzeugt ein frisches Dokument ohne Lightfox-Scripte.
let pageWindow;
function loadPage() {
  pageWindow = new JSDOM(badPage, { url: pageUrl, pretendToBeVisual: true, runScripts: 'outside-only' }).window;
  // jsdom kennt keine Performance-Timeline; Firefox liefert hier Navigation/Resource Timing.
  pageWindow.performance.getEntriesByType = () => [];
}

// --- Fake-APIs für den Background --------------------------------------------
const state = { reloads: 0, injections: [] };
loadPage();

function injectFile(file) {
  if (file !== 'content.js' && file !== 'axe.min.js') throw new Error(`Unbekannte Datei: ${file}`);
  pageWindow.eval(read(file));
  state.injections.push(file);
}

const backgroundBrowser = {
  runtime: {
    onMessage: popupToBackground,
    getManifest: () => JSON.parse(read('manifest.json')),
  },
  tabs: {
    async get(id) {
      if (id !== tabId) throw new Error('Tab nicht gefunden');
      return { id, url: pageUrl };
    },
    async reload(id, options) {
      assert.equal(id, tabId);
      assert.equal(options?.bypassCache, true, 'Neuladen muss den Cache umgehen (wie Lighthouse)');
      state.reloads++;
      setTimeout(() => {
        void tabUpdated.deliver(tabId, { status: 'loading' });
        loadPage();
        setTimeout(() => void tabUpdated.deliver(tabId, { status: 'complete' }), 20);
      }, 10);
    },
    onUpdated: tabUpdated,
    onRemoved: { addListener() {} },
  },
  scripting: {
    async executeScript({ target, files, func }) {
      assert.equal(target.tabId, tabId);
      if (func) {
        // Wie Firefox: func wird serialisiert, im Seitenkontext ausgeführt, das Promise abgewartet.
        return [{ result: await pageWindow.eval(`(${func.toString()})()`) }];
      }
      for (const file of files) injectFile(file);
      return [{ result: undefined }];
    },
  },
};

// Background-Bundle laden (IIFE, `browser` als Parameter)
// eslint-disable-next-line no-new-func
new Function('browser', read('background.js'))(backgroundBrowser);
assert.ok(popupToBackground.size === 1, 'Background-Listener muss registriert sein');

// --- Popup --------------------------------------------------------------------
// http-Origin statt file://, damit localStorage (Sprachwahl) verfügbar ist.
const popupDom = new JSDOM(read('popup.html'), { runScripts: 'outside-only', url: 'http://localhost/popup.html' });
const popupWindow = popupDom.window;
popupWindow.browser = {
  tabs: { query: async () => [{ id: tabId, url: pageUrl }] },
  runtime: { sendMessage: (message) => popupToBackground.deliver(message) },
};

popupWindow.eval(read('popup.js'));

// --- Warten, bis das Popup gerendert hat ---------------------------------------
async function waitFor(predicate, timeoutMs, what) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timeout beim Warten auf: ${what}. Popup-HTML:\n${popupDom.serialize().slice(0, 600)}`);
}

await waitFor(
  () => popupWindow.document.querySelectorAll('.gauge').length >= 4,
  60_000,
  'Score-Ringe (4 Gauges)',
);
await waitFor(() => popupWindow.document.querySelectorAll('.category').length === 3, 5_000, '3 Kategorien');
await waitFor(() => popupWindow.document.querySelectorAll('details.audit').length >= 15, 5_000, 'Audit-Reihen');

const gauges = [...popupWindow.document.querySelectorAll('.gauge-value')].map((n) => n.textContent);
const gaugeLabels = [...popupWindow.document.querySelectorAll('.gauge-label')].map((n) => n.textContent);
assert.deepEqual(gaugeLabels, ['Overall', 'Performance', 'Accessibility', 'Best Practices'], 'Standardsprache Englisch');
const closeButton = popupWindow.document.querySelector('button[aria-label="Close panel"]');
assert.ok(closeButton, 'Close-Button fehlt');
let closed = false;
popupWindow.close = () => { closed = true; };
closeButton.click();
assert.ok(closed, 'Close-Button muss das Panel schließen');
console.log('✓ Close-Button schließt das Panel; Gauge-Labels:', gaugeLabels.join(' / '));
console.log('✓ Popup gerendert – Gauges:', gauges.join(' / '));

const categories = [...popupWindow.document.querySelectorAll('.category-head')].map((n) => n.textContent.trim());
console.log('✓ Kategorien:', categories.join(' | '));

const auditCount = popupWindow.document.querySelectorAll('details.audit').length;
console.log(`✓ ${auditCount} Audit-Reihen (aufklappbar)`);
assert.ok(auditCount >= 15, 'Audit-Liste unerwartet kurz');

// --- Lighthouse-Ablauf: einmal neu geladen, danach content.js + axe.min.js injiziert ----
assert.equal(state.reloads, 1, 'die Seite muss für die Analyse genau einmal neu geladen werden');
assert.deepEqual(state.injections, ['content.js', 'axe.min.js'], 'Scripte erst nach dem Neuladen injizieren');
const version = JSON.parse(read('manifest.json')).version;
assert.ok(popupWindow.document.querySelector('.version').textContent.includes(version), 'Version aus manifest.json erwartet');
console.log(`✓ Analyse: Seite ohne Cache neu geladen, danach content.js + axe.min.js injiziert (v${version})`);

// --- Cache-Pfad: zweiter GET_REPORT muss ohne erneutes Neuladen antworten ---------
const firstAuditDone = Date.now();
const cachedResponse = await popupToBackground.deliver({ type: 'GET_REPORT', tabId, force: false, lang: 'en' });
assert.equal(cachedResponse.status, 'ok', 'zweiter GET_REPORT muss aus dem Cache kommen');
assert.equal(state.reloads, 1, 'Cache-Treffer darf die Seite nicht neu laden');
const cacheRoundtrip = Date.now() - firstAuditDone;
assert.ok(cacheRoundtrip < 1_000, `Cache-Zugriff war zu langsam (${cacheRoundtrip} ms)`);
console.log(`✓ Cache-Zugriff (2. Panel-Öffnung): ${cacheRoundtrip} ms`);

// --- Fehler-Pfad: geschützte Seite ---------------------------------------------
const errorResponse = await popupToBackground.deliver({ type: 'GET_REPORT', tabId: 99, force: true, lang: 'en' });
assert.equal(errorResponse.status, 'error', 'ungültiger Tab muss einen Fehler liefern');
console.log(`✓ Fehler-Pfad (unbekannter Tab): ${errorResponse.message}`);

// --- Sprachwechsel: DE klicken → deutscher Report aus der gecachten Messung (kein Neuladen) ---
popupWindow.document.querySelector('.lang-btn[lang="de"]').click();
await waitFor(
  () => [...popupWindow.document.querySelectorAll('.gauge-label')].map((n) => n.textContent).includes('Gesamt'),
  5_000,
  'deutsche Gauge-Labels',
);
const germanLabels = [...popupWindow.document.querySelectorAll('.gauge-label')].map((n) => n.textContent);
assert.deepEqual(germanLabels, ['Gesamt', 'Performance', 'Barrierefreiheit', 'Best Practices']);
assert.equal(popupWindow.document.documentElement.lang, 'de');
assert.equal(popupWindow.localStorage.getItem('lightfox.lang'), 'de', 'Sprachwahl muss gemerkt werden');
assert.equal(state.reloads, 1, 'Sprachwechsel darf die Seite nicht neu laden');
const germanGauges = [...popupWindow.document.querySelectorAll('.gauge-value')].map((n) => n.textContent);
assert.deepEqual(germanGauges, gauges, 'Sprachwechsel darf die Scores nicht ändern');
console.log('✓ Sprachwechsel EN → DE:', germanLabels.join(' / '), '(ohne Neuladen, gemerkt)');

// --- Neu ausführen: erneutes Neuladen, Scripte im frischen Dokument neu injiziert ---
const rerun = await popupToBackground.deliver({ type: 'GET_REPORT', tabId, force: true, lang: 'de' });
assert.equal(rerun.status, 'ok', () => `Neu ausführen fehlgeschlagen: ${rerun.message}`);
assert.equal(state.reloads, 2, '„Neu ausführen“ muss die Seite erneut laden');
assert.deepEqual(state.injections, ['content.js', 'axe.min.js', 'content.js', 'axe.min.js']);
console.log('✓ Neu ausführen: Seite erneut geladen, Scripte frisch injiziert');

console.log('\nE2E-Simulation bestanden ✅ (Popup → Background → Content + axe → zurück, inkl. Cache & Fehlerfall)');
