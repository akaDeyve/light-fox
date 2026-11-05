/**
 * Performance-Datensammler (Content-Script).
 * LCP über `web-vitals` (buffered Observer – erfasst auch Einträge vor der Injektion);
 * TTFB, Ladezeit, Ressourcen und Bytes aus Navigation/Resource Timing.
 * CLS/INP sind vorerst entfernt (TODO in der README): Firefox misst kein CLS, und INP
 * braucht eine Interaktion, die es direkt nach dem Neuladen nie gibt.
 *
 * Quellen:
 * - web-vitals: https://github.com/GoogleChrome/web-vitals
 * - MDN PerformanceNavigationTiming: https://developer.mozilla.org/docs/Web/API/PerformanceNavigationTiming
 * - MDN PerformanceResourceTiming: https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming
 */

import { onLCP } from 'web-vitals';
import type { PerfPayload } from '../shared/types';

/** Startet die LCP-Beobachtung und liefert eine Snapshot-Funktion. */
export function startPerfCollection(): () => PerfPayload {
  let lcp: number | null = null;
  // reportAllChanges: jeden neuen Wert sofort melden, nicht erst beim Verlassen der Seite.
  onLCP((metric) => (lcp = metric.value), { reportAllChanges: true });

  return () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const transferBytes = [navigation, ...resources].reduce((sum, entry) => sum + (entry?.transferSize ?? 0), 0);
    return {
      ttfb: navigation?.responseStart || null,
      lcp,
      loadTime: navigation?.loadEventEnd || null,
      transferBytes: transferBytes || null,
      resourceCount: resources.length,
      domNodeCount: document.getElementsByTagName('*').length,
    };
  };
}
