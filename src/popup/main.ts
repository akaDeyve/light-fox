/**
 * Popup-Entry: Fordert den Report vom Background an und rendert ihn.
 * Neu ausführen (force), JSON-Export und Sprachwahl (EN/DE, gemerkt in localStorage).
 */

import { t, type Lang } from '../shared/i18n';
import type { PanelResponse, Report } from '../shared/types';
import { renderError, renderLoading, renderReport, type View } from './render';

const LANG_KEY = 'lightfox.lang';
const root = document.getElementById('app') as HTMLElement;
let lang: Lang = localStorage.getItem(LANG_KEY) === 'de' ? 'de' : 'en';
let currentReport: Report | null = null;

/** Report anfordern und rendern; force = Seite neu laden und neu messen. */
async function load(force = false): Promise<void> {
  document.documentElement.lang = lang;
  const view: View = { lang, onLanguage: setLanguage };
  renderLoading(root, view);
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const response: PanelResponse = tab?.id == null
    ? { status: 'error', message: t(lang, 'error.noTab') }
    : await browser.runtime.sendMessage({ type: 'GET_REPORT', tabId: tab.id, force, lang });
  const rerun = () => void load(true);
  if (response.status === 'ok') {
    currentReport = response.report;
    renderReport(root, response.report, { ...view, onRerun: rerun, onExport: exportJson });
  } else {
    currentReport = null;
    renderError(root, response.message, { ...view, onRetry: rerun });
  }
}

/** Sprachwechsel: Der Background bewertet die gecachte Messung neu – kein Neuladen der Seite. */
function setLanguage(next: Lang): void {
  lang = next;
  localStorage.setItem(LANG_KEY, next);
  void load();
}

function exportJson(): void {
  if (!currentReport) return;
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), report: currentReport }, null, 2)], {
    type: 'application/json',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `lightfox-report-${new URL(currentReport.url).hostname}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5_000);
}

void load();
