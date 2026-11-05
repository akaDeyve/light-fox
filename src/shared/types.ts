/**
 * Gemeinsame Typen für den Datenaustausch zwischen
 * Content-Script → Background (Event-Page) → Popup.
 *
 * Abhängigkeitsregel: content/ und popup/ importieren nur aus shared/;
 * Scoring und Audit-Konfiguration liegen ausschließlich in background/.
 * Das Content-Script liefert sprachneutrale Rohdaten, Texte entstehen erst im Scoring.
 */

import type { Lang } from './i18n';

export type CategoryId = 'performance' | 'accessibility' | 'best-practices';

export type AuditStatus = 'pass' | 'average' | 'fail' | 'na';

export interface DocsLink {
  label: string;
  url: string;
}

export interface AuditItem {
  label: string;
  detail?: string;
}

export interface AuditResult {
  id: string;
  title: string;
  status: AuditStatus;
  /** 0..1, null bei n/a */
  score: number | null;
  weight: number;
  /** Formatierter Messwert, z. B. "2.4 s" */
  value?: string;
  description: string;
  docs?: DocsLink[];
  items?: AuditItem[];
}

export interface CategoryReport {
  id: CategoryId;
  label: string;
  /** 0..100, null wenn Kategorie nicht bewertbar */
  score: number | null;
  summary: string;
  audits: AuditResult[];
}

export interface Report {
  url: string;
  title: string | null;
  timestamp: number;
  durationMs: number;
  /** 0..100, null wenn keine Kategorie bewertbar */
  overall: number | null;
  categories: CategoryReport[];
  version: string;
  lang: Lang;
}

// ---------------------------------------------------------------------------
// Rohdaten, die das Content-Script liefert (vor dem Scoring, sprachneutral).
// ---------------------------------------------------------------------------

/** null = nicht gemessen bzw. vom Browser nicht unterstützt. */
export interface PerfPayload {
  ttfb: number | null;
  lcp: number | null;
  loadTime: number | null;
  transferBytes: number | null;
  resourceCount: number;
  domNodeCount: number;
}

export interface AxeViolationPayload {
  id: string;
  help: string;
  helpUrl: string;
  impact: string | null;
  tags: string[];
  nodes: Array<{ target: string; html: string }>;
}

export interface A11yPayload {
  /** gesetzt, wenn axe nicht laufen konnte */
  error: string | null;
  ruleCount: number;
  passCount: number;
  violations: AxeViolationPayload[];
}

export interface BpFinding {
  id: string;
  /** null: Bewertung im Scoring anhand von ratio und den Schwellwerten */
  level: 'pass' | 'fail' | 'na' | null;
  /** Anteil "schlechter" Ressourcen in [0,1] für ratio-basierte Checks, sonst null */
  ratio: number | null;
  /** sprachneutraler Messwert (Zahl, Protokoll, Attributwert …) */
  value: string | null;
  items: string[];
}

export interface AuditPayload {
  perf: PerfPayload;
  a11y: A11yPayload;
  bp: BpFinding[];
  meta: { url: string; title: string | null };
}

// ---------------------------------------------------------------------------
// Kommunikation
// ---------------------------------------------------------------------------

/** Popup → Background (force = Seite neu laden und neu messen) */
export interface GetReportMessage {
  type: 'GET_REPORT';
  tabId: number;
  force?: boolean;
  lang: Lang;
}

/** Vom Content-Script im Sandbox-Window registrierte API, aufgerufen per executeScript({ func }). */
export interface ContentApi {
  run(): Promise<AuditPayload>;
}

declare global {
  interface Window {
    __lightfox?: ContentApi;
  }
}

/** Background → Popup */
export type PanelResponse = { status: 'ok'; report: Report } | { status: 'error'; message: string };
