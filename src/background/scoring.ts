/**
 * Scoring: sprachneutrale Rohdaten des Content-Scripts → gewichtete Audit-Ergebnisse
 * → Kategorie-Scores (0–100) → Gesamtscore, mit Texten in der gewünschten Sprache.
 *
 * Modell:
 * - Kontinuierliche Metriken: linearer Score zwischen good (1) und poor (0).
 * - axe-Verletzungen: Score 0, Gewicht nach Impact; bestandene Regeln zählen mit RULE_BASE_WEIGHT.
 * - Kategorie-Score = Σ(score·w)/Σ(w); n/a-Audits fließen nicht ein.
 *
 * Quellen:
 * - Lighthouse Scoring (Vorbild): https://developer.chrome.com/docs/lighthouse/performance/performance-scoring
 * - web.dev Vital-Schwellwerte: https://web.dev/articles/vitals#core-web-vitals
 */

import axeDe from 'axe-core/locales/de.json';
import { formatBytes, formatMs, formatNumber } from '../shared/format';
import { auditText, t, type Lang } from '../shared/i18n';
import type { A11yPayload, AuditPayload, AuditResult, AuditStatus, BpFinding, CategoryId, CategoryReport, PerfPayload, Report } from '../shared/types';
import {
  BP_AUDITS,
  CATEGORY_WEIGHTS,
  DEFAULT_IMPACT_WEIGHT,
  IMPACT_WEIGHTS,
  PERFORMANCE_METRICS,
  RULE_BASE_WEIGHT,
  type MetricConfig,
} from './audit-config';

/** Deutsche axe-Regeltitel (aus axe-cores Locale-Datei, ohne axe.configure in der Seite). */
const AXE_HELP_DE: Record<string, { help?: string }> = axeDe.rules;

function lerpScore(value: number, good: number, poor: number): number {
  if (value <= good) return 1;
  if (value >= poor) return 0;
  return (poor - value) / (poor - good);
}

function statusFromThresholds(value: number, good: number, poor: number): AuditStatus {
  if (value <= good) return 'pass';
  if (value >= poor) return 'fail';
  return 'average';
}

function weightedScore(audits: AuditResult[]): number | null {
  const rated = audits.filter((audit) => audit.score != null);
  const weight = rated.reduce((sum, audit) => sum + audit.weight, 0);
  return weight > 0 ? (rated.reduce((sum, audit) => sum + (audit.score ?? 0) * audit.weight, 0) / weight) * 100 : null;
}

const STATUS_ORDER: Record<AuditStatus, number> = { fail: 0, average: 1, pass: 2, na: 3 };

function category(id: CategoryId, lang: Lang, audits: AuditResult[], summary: string, score = weightedScore(audits)): CategoryReport {
  const sorted = [...audits].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.weight - a.weight);
  return { id, label: t(lang, `category.${id}`), score, summary, audits: sorted };
}

function countSummary(lang: Lang, key: 'summary.metrics' | 'summary.checks', audits: AuditResult[]): string {
  const total = audits.filter((audit) => audit.status !== 'na').length;
  const passing = audits.filter((audit) => audit.status === 'pass').length;
  return t(lang, key, { passing, total });
}

// --- Performance --------------------------------------------------------------

function formatMetric(unit: MetricConfig['unit'], value: number, lang: Lang): string {
  if (unit === 'ms') return formatMs(value, lang);
  if (unit === 'bytes') return formatBytes(value, lang);
  return formatNumber(value, lang);
}

function perfCategory(perf: PerfPayload, lang: Lang): CategoryReport {
  const audits = PERFORMANCE_METRICS.map((config): AuditResult => {
    const { title, description } = auditText(lang, config.id);
    const thresholds = t(lang, 'audit.thresholds', {
      good: formatMetric(config.unit, config.good, lang),
      poor: formatMetric(config.unit, config.poor, lang),
    });
    const base = { id: config.id, title, weight: config.weight, docs: config.docs, description: `${description} ${thresholds}` };
    const value = perf[config.id];
    if (value == null) {
      return { ...base, status: 'na', score: null, description: `${base.description} ${t(lang, 'audit.notRated', { reason: t(lang, 'reason.perf') })}` };
    }
    return {
      ...base,
      status: statusFromThresholds(value, config.good, config.poor),
      score: lerpScore(value, config.good, config.poor),
      value: formatMetric(config.unit, value, lang),
    };
  });
  return category('performance', lang, audits, countSummary(lang, 'summary.metrics', audits));
}

// --- Barrierefreiheit (axe-core) ----------------------------------------------

/** axe-Tags wie "wcag412" → "WCAG 4.1.2"; ohne WCAG-Bezug → "best practice". */
function wcagReferences(tags: string[], lang: Lang): string {
  const criteria = tags.flatMap((tag) => {
    const match = /^wcag(\d)(\d)(\d{1,2})$/.exec(tag);
    return match ? [`WCAG ${match[1]}.${match[2]}.${match[3]}`] : [];
  });
  return criteria.length > 0 ? criteria.join(', ') : t(lang, 'a11y.bestPractice');
}

function a11yCategory(a11y: A11yPayload, lang: Lang): CategoryReport {
  if (a11y.error != null) {
    const audit: AuditResult = {
      id: 'axe',
      title: t(lang, 'a11y.unavailableTitle'),
      status: 'na',
      score: null,
      weight: 0,
      description: t(lang, 'a11y.unavailable', { error: a11y.error }),
    };
    return category('accessibility', lang, [audit], t(lang, 'summary.unavailable'), null);
  }

  const audits = a11y.violations.map((violation): AuditResult => ({
    id: `axe-${violation.id}`,
    title: (lang === 'de' && AXE_HELP_DE[violation.id]?.help) || violation.help,
    status: 'fail',
    score: 0,
    weight: IMPACT_WEIGHTS[violation.impact ?? ''] ?? DEFAULT_IMPACT_WEIGHT,
    value: t(lang, 'a11y.value', { count: formatNumber(violation.nodes.length, lang), impact: violation.impact ?? '?' }),
    description: t(lang, 'a11y.desc', { id: violation.id, wcag: wcagReferences(violation.tags, lang) }),
    docs: [{ label: `axe-core: ${violation.id}`, url: violation.helpUrl }],
    items: violation.nodes.map((node) => ({ label: node.target, detail: node.html })),
  }));

  const violatedWeight = audits.reduce((sum, audit) => sum + audit.weight, 0);
  const passedWeight = RULE_BASE_WEIGHT * a11y.passCount;
  const score = passedWeight + violatedWeight > 0 ? (passedWeight / (passedWeight + violatedWeight)) * 100 : null;
  const summary = t(lang, 'summary.a11y', {
    rules: formatNumber(a11y.ruleCount, lang),
    passed: formatNumber(a11y.passCount, lang),
    violated: formatNumber(audits.length, lang),
  });
  return category('accessibility', lang, audits, summary, score);
}

// --- Best Practices -----------------------------------------------------------

function bpCategory(findings: BpFinding[], lang: Lang): CategoryReport {
  const byId = new Map(findings.map((finding) => [finding.id, finding]));
  const audits = BP_AUDITS.map((config): AuditResult => {
    const finding = byId.get(config.id);
    const { title, description } = auditText(lang, config.id);
    const base = {
      id: config.id,
      title,
      weight: config.weight,
      docs: config.docs,
      value: finding?.value ?? undefined,
      items: finding?.items.map((label) => ({ label })),
    };
    if (config.ratio && finding?.ratio != null) {
      const { good, poor } = config.ratio;
      return {
        ...base,
        status: statusFromThresholds(finding.ratio, good, poor),
        score: lerpScore(finding.ratio, good, poor),
        description: `${description} ${t(lang, 'audit.ratioThresholds', { good: good * 100, poor: poor * 100 })}`,
      };
    }
    if (finding?.level === 'pass' || finding?.level === 'fail') {
      return { ...base, status: finding.level, score: finding.level === 'pass' ? 1 : 0, description };
    }
    return { ...base, status: 'na', score: null, description: `${description} ${t(lang, 'audit.notRated', { reason: t(lang, 'reason.bp') })}` };
  });
  return category('best-practices', lang, audits, countSummary(lang, 'summary.checks', audits));
}

// --- Gesamt-Report ------------------------------------------------------------

export interface Measurement {
  payload: AuditPayload;
  durationMs: number;
  timestamp: number;
}

export function scoreReport({ payload, durationMs, timestamp }: Measurement, version: string, lang: Lang): Report {
  const categories = [perfCategory(payload.perf, lang), a11yCategory(payload.a11y, lang), bpCategory(payload.bp, lang)];
  const rated = categories.filter((c) => c.score != null);
  const weight = rated.reduce((sum, c) => sum + CATEGORY_WEIGHTS[c.id], 0);
  const overall = weight > 0 ? rated.reduce((sum, c) => sum + (c.score ?? 0) * CATEGORY_WEIGHTS[c.id], 0) / weight : null;
  return {
    url: payload.meta.url,
    title: payload.meta.title,
    timestamp,
    durationMs: Math.round(durationMs),
    overall,
    categories,
    version,
    lang,
  };
}
