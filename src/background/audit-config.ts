/**
 * Zentrale Audit-Konfiguration: Schwellwerte, Gewichte, Dokumentation (Texte: shared/i18n.ts).
 * Wird ausschließlich vom Scoring im Background genutzt.
 */

import type { CategoryId, DocsLink, PerfPayload } from '../shared/types';

/** Gewichtung der Kategorien für den Gesamtscore. */
export const CATEGORY_WEIGHTS: Record<CategoryId, number> = {
  performance: 0.4,
  accessibility: 0.4,
  'best-practices': 0.2,
};

/** Gewicht einer verletzten axe-Regel nach Impact; bestandene Regeln zählen mit RULE_BASE_WEIGHT. */
export const IMPACT_WEIGHTS: Record<string, number> = { critical: 10, serious: 7, moderate: 4, minor: 2 };
export const DEFAULT_IMPACT_WEIGHT = 5;
export const RULE_BASE_WEIGHT = 7;

export interface MetricConfig {
  id: keyof PerfPayload;
  weight: number;
  /** Wert ≤ good → Score 1 */
  good: number;
  /** Wert ≥ poor → Score 0 */
  poor: number;
  unit: 'ms' | 'bytes' | 'count';
  docs?: DocsLink[];
}

const mdn = (label: string, path: string): DocsLink => ({ label: `MDN: ${label}`, url: `https://developer.mozilla.org/docs/${path}` });
const webDev = (label: string, slug: string): DocsLink => ({ label: `web.dev: ${label}`, url: `https://web.dev/articles/${slug}` });

export const PERFORMANCE_METRICS: MetricConfig[] = [
  { id: 'ttfb', weight: 3, good: 800, poor: 1800, unit: 'ms', docs: [webDev('TTFB', 'ttfb')] },
  { id: 'lcp', weight: 5, good: 2500, poor: 4000, unit: 'ms', docs: [webDev('LCP', 'lcp')] },
  { id: 'loadTime', weight: 3, good: 3000, poor: 8000, unit: 'ms', docs: [mdn('PerformanceNavigationTiming', 'Web/API/PerformanceNavigationTiming')] },
  { id: 'transferBytes', weight: 2, good: 2_000_000, poor: 5_000_000, unit: 'bytes', docs: [mdn('PerformanceResourceTiming', 'Web/API/PerformanceResourceTiming')] },
  { id: 'resourceCount', weight: 1, good: 50, poor: 120, unit: 'count' },
  { id: 'domNodeCount', weight: 1, good: 1500, poor: 4000, unit: 'count', docs: [webDev('DOM size', 'dom-size')] },
];

export interface BpConfig {
  id: string;
  weight: number;
  /** Schwellwerte für ratio-basierte Checks (Anteil "schlechter" Ressourcen) */
  ratio?: { good: number; poor: number };
  docs?: DocsLink[];
}

export const BP_AUDITS: BpConfig[] = [
  { id: 'https', weight: 3, docs: [mdn('Secure contexts', 'Web/Security/Secure_Contexts')] },
  { id: 'viewport', weight: 2, docs: [mdn('viewport', 'Web/HTML/Viewport_meta_tag')] },
  { id: 'quirks-mode', weight: 2, docs: [mdn('Quirks mode', 'Web/HTML/Quirks_Mode_and_Standards_Mode')] },
  { id: 'mixed-content', weight: 2, docs: [mdn('Mixed content', 'Web/Security/Mixed_content')] },
  { id: 'charset', weight: 1, docs: [mdn('charset', 'Web/HTML/Element/meta#charset')] },
  { id: 'deprecated-html', weight: 1, docs: [mdn('Obsolete HTML', 'Web/HTML/Element#obsolete_and_deprecated_elements')] },
  { id: 'anchor-noopener', weight: 1, docs: [mdn('rel=noopener', 'Web/HTML/Attributes/rel/noopener')] },
  { id: 'image-formats', weight: 1, ratio: { good: 0.1, poor: 0.6 }, docs: [webDev('Image formats', 'image-formats')] },
  { id: 'image-aspect-ratio', weight: 1 },
  { id: 'http2', weight: 1, ratio: { good: 0.05, poor: 0.5 }, docs: [mdn('nextHopProtocol', 'Web/API/PerformanceResourceTiming/nextHopProtocol')] },
];
