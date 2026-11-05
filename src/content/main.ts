/**
 * Content-Script-Entry: Web-Vitals-Beobachtung starten und `window.__lightfox.run()`
 * bereitstellen. Wird nur für eine Analyse vom Background in die frisch neu geladene Seite
 * injiziert (zusammen mit axe-core). Der Background ruft run() per
 * scripting.executeScript({ func }) auf und erhält die Rohdaten als Rückgabewert.
 */

import { runAxe } from './axe-runner';
import { collectBestPractices } from './best-practices';
import { startPerfCollection } from './perf';

const perfSnapshot = startPerfCollection();

window.__lightfox = {
  async run() {
    // Gepufferte Observer-Einträge werden asynchron zugestellt – erst danach messen.
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      perf: perfSnapshot(),
      a11y: await runAxe(),
      bp: collectBestPractices(),
      meta: { url: location.href, title: document.title || null },
    };
  },
};
