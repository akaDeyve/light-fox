/**
 * Integrationstest der Content-Pipeline (ohne Browser):
 * - axe.min.js (echtes axe-core, wie im Build ausgeliefert) wird in jsdom geladen
 * - axe-runner.ts führt einen echten axe-Run gegen eine "schlechte" Seite aus (auch ohne eval/CSP)
 * - best-practices.ts prüft die erwarteten Findings
 * - perf.ts (web-vitals) snapshot ohne Web-Vitals-Einträge (n/a, kein Crash)
 * - scoring.ts erzeugt aus denselben Rohdaten vollständige Reports auf Englisch und Deutsch
 *
 * Aufruf: npm test
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { JSDOM } from 'jsdom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pageUrl = 'https://example.com/test';

const badPage = `<!DOCTYPE html>
<html lang="de">
<head>
  <title>Integrationstest</title>
</head>
<body>
  <center>Zentrierter Legacy-Text</center>
  <div bgcolor="#ff0000">Veraltetes Attribut</div>
  <img src="https://example.com/hero.jpg" width="600">
  <input type="text" id="search">
  <a href="https://external.example.org/" target="_blank">Externer Link</a>
  <a href="https://example.com/intern" target="_blank" rel="noopener">Interner Link</a>
  <script src="http://insecure.example.com/legacy.js"></script>
</body>
</html>`;

// --- Globals für die Bundles setzen ---------------------------------------
// runScripts: 'outside-only' nötig, damit axe.min.js per window.eval im Fenster-Realm läuft.
const dom = new JSDOM(badPage, { url: pageUrl, pretendToBeVisual: true, runScripts: 'outside-only' });

// Node 22 definiert z. B. navigator nur als Getter → defineProperty statt Zuweisung.
// `performance` wird NICHT überschrieben: jsdoms Performance.now() ruft selbst das
// Node-Global auf (Endlos-Rekursion); Nodes perf_hooks-Performance genügt für die
// Bundles (getEntriesByType liefert dort einfach leere Arrays).
for (const [name, value] of [
  ['window', dom.window],
  ['document', dom.window.document],
  ['navigator', dom.window.navigator],
  ['location', dom.window.location],
  // web-vitals registriert globale Listener (pageshow, visibilitychange) wie im echten Content-Script.
  ['addEventListener', dom.window.addEventListener.bind(dom.window)],
  ['removeEventListener', dom.window.removeEventListener.bind(dom.window)],
]) {
  Object.defineProperty(globalThis, name, { get: () => value, configurable: true });
}

// --- Module im Speicher bündeln und laden (kein temporäres Verzeichnis) ----------
async function load(entry) {
  const { outputFiles } = await esbuild.build({
    entryPoints: [resolve(root, entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'error',
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);
}

// --- Tests -------------------------------------------------------------------
const { runAxe } = await load('src/content/axe-runner.ts');
assert.ok((await runAxe()).error, 'vor Injektion muss runAxe einen Fehler melden');

dom.window.eval(readFileSync(resolve(root, 'node_modules/axe-core/axe.min.js'), 'utf8'));

// Wie auf Seiten mit CSP ohne 'unsafe-eval' (z. B. Moodle): axe muss ohne new Function() laufen.
const NativeFunction = dom.window.Function;
dom.window.Function = function blockedByCsp() {
  throw new dom.window.EvalError('call to Function() blocked by CSP');
};
const a11y = await runAxe();
dom.window.Function = NativeFunction;

assert.equal(a11y.error, null, () => `axe fehlgeschlagen: ${a11y.error}`);
assert.ok(a11y.ruleCount > 50, `erwartet >50 axe-Regeln, got ${a11y.ruleCount}`);
const violatedIds = a11y.violations.map((v) => v.id);
assert.ok(violatedIds.includes('image-alt'), `image-alt fehlt in ${JSON.stringify(violatedIds)}`);
assert.ok(violatedIds.includes('label'), `label fehlt in ${JSON.stringify(violatedIds)}`);
const imageAlt = a11y.violations.find((v) => v.id === 'image-alt');
assert.equal(imageAlt.impact, 'critical');
assert.equal(typeof imageAlt.nodes[0].target, 'string', 'Target muss serialisiert sein');
assert.ok(imageAlt.nodes[0].html.includes('<img'), 'HTML-Snippet erwartet');
assert.ok(imageAlt.helpUrl.startsWith('https://'), 'helpUrl erwartet');
console.log(`✓ axe-core (eval blockiert): ${a11y.ruleCount} Regeln, ${a11y.violations.length} Verletzungen (${violatedIds.join(', ')})`);

const { collectBestPractices } = await load('src/content/best-practices.ts');
const findings = collectBestPractices();
const byId = new Map(findings.map((f) => [f.id, f]));
const expect = (id, level) => {
  const f = byId.get(id);
  assert.ok(f, `Finding ${id} fehlt`);
  assert.equal(f.level, level, `${id}: erwartet ${level}, got ${f.level}`);
  console.log(`✓ bp/${id}: ${level} (${f.value})`);
};
expect('https', 'pass');
expect('viewport', 'fail');
expect('mixed-content', 'fail');
expect('charset', 'fail');
expect('deprecated-html', 'fail');
expect('anchor-noopener', 'fail');
expect('image-formats', 'na');
expect('image-aspect-ratio', 'na');
expect('http2', 'na');
assert.deepEqual(byId.get('deprecated-html').items, ['center ×1', '[bgcolor] ×1']);
assert.deepEqual(byId.get('mixed-content').items, ['<script> http://insecure.example.com/legacy.js']);
assert.deepEqual(byId.get('anchor-noopener').items, ['https://external.example.org/'], 'nur der externe Link ohne noopener');

const { startPerfCollection } = await load('src/content/perf.ts');
const perf = startPerfCollection()();
assert.equal(perf.lcp, null);
assert.equal(perf.loadTime, null);
assert.equal(perf.resourceCount, 0);
assert.ok(perf.domNodeCount > 5);
console.log('✓ perf.ts: ohne Web-Vitals-Einträge sauber auf n/a (kein Crash)');

// --- Scoring + Mehrsprachigkeit ------------------------------------------------
const { scoreReport } = await load('src/background/scoring.ts');
const measurement = {
  payload: { perf, a11y, bp: findings, meta: { url: pageUrl, title: 'Test' } },
  durationMs: 1234,
  timestamp: Date.now(),
};
const reports = { en: scoreReport(measurement, '0.0.0', 'en'), de: scoreReport(measurement, '0.0.0', 'de') };
for (const [lang, report] of Object.entries(reports)) {
  const texts = report.categories.flatMap((c) => [c.label, c.summary, ...c.audits.flatMap((a) => [a.title, a.description])]);
  assert.ok(texts.every((text) => text && !/\{\w+\}|\.(title|desc)$/.test(text)), `${lang}: Text mit offenem Platzhalter/Schlüssel`);
  assert.equal(report.lang, lang);
}
const altTitle = (lang) => reports[lang].categories[1].audits.find((a) => a.id === 'axe-image-alt').title;
assert.equal(altTitle('en'), 'Images must have alternative text');
assert.equal(altTitle('de'), 'Abbildungen müssen einen Alternativtext besitzen.');
assert.deepEqual(reports.en.categories.map((c) => c.label), ['Performance', 'Accessibility', 'Best Practices']);
assert.deepEqual(reports.de.categories.map((c) => c.label), ['Performance', 'Barrierefreiheit', 'Best Practices']);
assert.equal(reports.en.overall, reports.de.overall, 'Sprache darf den Score nicht ändern');
console.log(`✓ Scoring EN/DE: „${altTitle('en')}“ / „${altTitle('de')}“, Gesamt ${Math.round(reports.en.overall)}`);

console.log('\nAlle Content-Pipeline-Tests bestanden ✅');
