/**
 * Background (MV3 Event-Page): Orchestriert Audits – nach dem Vorbild von Lighthouse
 * (Navigation-Modus) wird die Seite für jede Messung frisch geladen:
 *
 * Popup → GET_REPORT → Tab ohne Cache neu laden → auf load + Ruhezeit warten
 * → content.js + axe.min.js injizieren → __lightfox.run() → Messung cachen → Scoring → Popup.
 *
 * Gecacht wird die sprachneutrale Messung: Ein Sprachwechsel im Popup bewertet sie nur neu.
 *
 * Quellen:
 * - MDN tabs.reload: https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/tabs/reload
 * - MDN scripting.executeScript: https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript
 * - Lighthouse (Navigation-Modus, Vorbild): https://github.com/GoogleChrome/lighthouse/blob/main/docs/user-flows.md
 */

import { t, type MessageKey } from '../shared/i18n';
import type { AuditPayload, GetReportMessage, PanelResponse } from '../shared/types';
import { scoreReport, type Measurement } from './scoring';

const CACHE_TTL_MS = 5 * 60_000;
/** Maximale Wartezeit auf das load-Ende; manche Seiten (z. B. Moodle) laden nie ganz fertig. */
const LOAD_TIMEOUT_MS = 30_000;
/** Ruhezeit nach dem letzten load-Ende: späte LCP-Kandidaten erfassen, sich selbst ersetzende Zwischenseiten abwarten. */
const SETTLE_MS = 1_000;
const VERSION = browser.runtime.getManifest().version;

/** Erwarteter Fehler mit übersetzbarer Meldung. */
class AuditError extends Error {
  constructor(readonly key: MessageKey) {
    super(key);
  }
}

const cache = new Map<number, Measurement & { url: string }>();
const running = new Map<number, Promise<Measurement & { url: string }>>();

browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as GetReportMessage;
  return msg?.type === 'GET_REPORT' ? handleGetReport(msg) : undefined;
});

async function handleGetReport({ tabId, force, lang }: GetReportMessage): Promise<PanelResponse> {
  try {
    const { url } = await browser.tabs.get(tabId);
    if (!/^https?:/.test(url ?? '')) throw new AuditError('error.notHttp');
    let measurement = cache.get(tabId);
    if (force || !measurement || measurement.url !== url || Date.now() - measurement.timestamp > CACHE_TTL_MS) {
      measurement = await measureOnce(tabId);
      cache.set(tabId, measurement);
    }
    return { status: 'ok', report: scoreReport(measurement, VERSION, lang) };
  } catch (error) {
    console.error('[Lightfox] Audit fehlgeschlagen:', error);
    const message = error instanceof AuditError
      ? t(lang, error.key)
      : t(lang, 'error.unexpected', { message: error instanceof Error ? error.message : String(error) });
    return { status: 'error', message };
  }
}

/** Läuft für den Tab schon eine Messung (z. B. Popup erneut geöffnet), wird sie geteilt. */
function measureOnce(tabId: number): Promise<Measurement & { url: string }> {
  let run = running.get(tabId);
  if (!run) {
    run = measure(tabId).finally(() => running.delete(tabId));
    running.set(tabId, run);
  }
  return run;
}

async function measure(tabId: number): Promise<Measurement & { url: string }> {
  const started = performance.now();
  await reloadAndWait(tabId);
  await browser.scripting
    .executeScript({ target: { tabId }, files: ['content.js', 'axe.min.js'] })
    .catch(() => Promise.reject(new AuditError('error.inject')));
  // func wird serialisiert und im Content-Script-Kontext ausgeführt; Firefox wartet auf das Promise.
  // (@types/firefox-webext-browser typisiert func zu eng als () => void.)
  const run = (() => window.__lightfox?.run()) as () => void;
  const [injection] = await browser.scripting.executeScript({ target: { tabId }, func: run });
  const payload = injection?.result as AuditPayload | undefined;
  if (!payload) throw new AuditError('error.noResult');
  return { url: payload.meta.url, payload, durationMs: performance.now() - started, timestamp: Date.now() };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Lädt den Tab ohne Cache neu (wie Lighthouse) und wartet, bis er SETTLE_MS lang "complete" ist,
 * ohne dass ein neuer Ladevorgang beginnt (max. LOAD_TIMEOUT_MS). So wird nicht eine Zwischenseite
 * gemessen, die sich gleich selbst ersetzt (z. B. Bot-Prüfung "Client Challenge" auf drupal.org).
 */
async function reloadAndWait(tabId: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onUpdated: (id: number, info: browser.tabs._OnUpdatedChangeInfo) => void = () => {};
  const settled = new Promise<void>((resolve) => {
    onUpdated = (id, info) => {
      if (id !== tabId || !info.status) return;
      clearTimeout(timer);
      if (info.status === 'complete') timer = setTimeout(resolve, SETTLE_MS);
    };
  });
  browser.tabs.onUpdated.addListener(onUpdated);
  try {
    await browser.tabs.reload(tabId, { bypassCache: true });
    await Promise.race([settled, sleep(LOAD_TIMEOUT_MS)]);
  } finally {
    clearTimeout(timer);
    browser.tabs.onUpdated.removeListener(onUpdated);
  }
}

// Messung bei Navigation/Reload bzw. Tab-Schließen verwerfen.
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' || changeInfo.url) cache.delete(tabId);
});
browser.tabs.onRemoved.addListener((tabId) => cache.delete(tabId));
