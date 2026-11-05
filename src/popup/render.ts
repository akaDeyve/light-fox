/**
 * Popup-Rendering (vanilla TS, kein Framework).
 * Score-Ringe als Inline-SVG, Audits als aufklappbare <details>-Reihen.
 * Optik: Firefox-Design-System „Nova“ (Tokens in public/popup.css).
 */

import { formatTimestamp } from '../shared/format';
import { LANGS, t, type Lang } from '../shared/i18n';
import type { AuditResult, AuditStatus, CategoryReport, Report } from '../shared/types';

export interface View {
  lang: Lang;
  onLanguage: (lang: Lang) => void;
}

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function button(attrs: Attrs, label: string, onClick: () => void): HTMLButtonElement {
  const node = el('button', { type: 'button', ...attrs }, label);
  node.addEventListener('click', onClick);
  return node;
}

const STATUS_GLYPH: Record<AuditStatus, string> = { pass: '✓', average: '!', fail: '✕', na: '–' };

function scoreColor(score: number | null): string {
  if (score == null) return 'var(--icon-color-na)';
  if (score >= 90) return 'var(--icon-color-success)';
  if (score >= 50) return 'var(--icon-color-warning)';
  return 'var(--icon-color-critical)';
}

const scoreText = (score: number | null) => (score == null ? '–' : String(Math.round(score)));

// --- Score-Ring -----------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function gauge(score: number | null, label: string, lang: Lang, big = false): HTMLElement {
  const size = big ? 96 : 74;
  const strokeWidth = big ? 7 : 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = scoreColor(score);
  const ring = { cx: size / 2, cy: size / 2, r: radius, fill: 'none', 'stroke-width': strokeWidth };

  const graphic = svg('svg', { class: 'gauge-svg', viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true' });
  graphic.append(
    svg('circle', { ...ring, stroke: 'var(--track)' }),
    svg('circle', {
      ...ring,
      stroke: color,
      'stroke-dasharray': circumference,
      'stroke-dashoffset': circumference * (1 - (score ?? 0) / 100),
      'stroke-linecap': 'round',
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
    }),
  );
  const ariaLabel = `${label}: ${score == null ? t(lang, 'popup.notRated') : `${Math.round(score)} / 100`}`;
  return el(
    'div',
    { class: big ? 'gauge gauge-big' : 'gauge' },
    graphic,
    el('div', { class: 'gauge-value', style: `color:${color}`, 'aria-label': ariaLabel }, scoreText(score)),
    el('div', { class: 'gauge-label', text: label }),
  );
}

// --- Layout-Teile ----------------------------------------------------------------

function closeButton(lang: Lang): HTMLElement {
  const icon = svg('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' });
  icon.append(svg('path', { d: 'M4 4l8 8M12 4l-8 8' }));
  const node = el('button', { class: 'icon-btn', type: 'button', title: t(lang, 'popup.close'), 'aria-label': t(lang, 'popup.close') }, icon);
  node.addEventListener('click', () => window.close());
  return node;
}

function languageSwitch({ lang, onLanguage }: View): HTMLElement {
  return el(
    'div',
    { class: 'lang-switch', role: 'group', 'aria-label': 'Language / Sprache' },
    ...LANGS.map((option) =>
      button({ class: 'lang-btn', lang: option, 'aria-pressed': option === lang }, option.toUpperCase(), () => {
        if (option !== lang) onLanguage(option);
      }),
    ),
  );
}

function header(view: View, page: HTMLElement | null, action: HTMLElement | null): HTMLElement {
  const brand = el('div', { class: 'brand' }, el('img', { src: 'icons/icon-32.png', alt: '', width: 20, height: 20 }), 'Lightfox');
  return el('header', { class: 'header' }, brand, page ?? el('div', { class: 'page' }), action, languageSwitch(view), closeButton(view.lang));
}

function auditRow(audit: AuditResult): HTMLElement {
  return el(
    'details',
    { class: `audit status-${audit.status}` },
    el(
      'summary',
      { class: 'audit-head' },
      el('span', { class: 'badge', 'aria-hidden': 'true', text: STATUS_GLYPH[audit.status] }),
      el('span', { class: 'audit-title', text: audit.title }),
      el('span', { class: 'audit-value', text: audit.value ?? '' }),
      el('span', { class: 'chev', 'aria-hidden': 'true' }, '›'),
    ),
    el(
      'div',
      { class: 'audit-body' },
      el('p', { class: 'audit-desc', text: audit.description }),
      !!audit.docs?.length &&
        el('p', { class: 'docs' }, ...audit.docs.map((doc) => el('a', { href: doc.url, target: '_blank', rel: 'noopener noreferrer' }, `${doc.label} ↗`))),
      !!audit.items?.length &&
        el('ul', { class: 'items' }, ...audit.items.map((item) =>
          el('li', {}, el('code', { text: item.label }), item.detail && el('span', { class: 'item-detail', text: ` — ${item.detail}` })),
        )),
    ),
  );
}

function categorySection(category: CategoryReport): HTMLElement {
  return el(
    'section',
    { class: 'category' },
    el(
      'header',
      { class: 'category-head' },
      el('span', { class: 'category-score', style: `color:${scoreColor(category.score)}`, text: scoreText(category.score) }),
      el('h2', { text: category.label }),
      el('span', { class: 'category-summary', text: category.summary }),
    ),
    el('div', { class: 'audits' }, ...category.audits.map(auditRow)),
  );
}

// --- Zustände ---------------------------------------------------------------------

export function renderLoading(root: HTMLElement, view: View): void {
  root.replaceChildren(
    header(view, null, null),
    el('div', { class: 'loading' }, el('div', { class: 'spinner', role: 'status', 'aria-label': t(view.lang, 'popup.loading') }), el('p', {}, t(view.lang, 'popup.loading'))),
  );
}

export function renderError(root: HTMLElement, message: string, view: View & { onRetry: () => void }): void {
  root.replaceChildren(
    header(view, null, null),
    el(
      'div',
      { class: 'error' },
      el('img', { class: 'error-icon', src: 'icons/icon-64.png', alt: '', width: 48, height: 48 }),
      el('h2', { text: t(view.lang, 'popup.errorTitle') }),
      el('p', { class: 'error-message', text: message }),
      button({ class: 'btn btn-primary' }, t(view.lang, 'popup.retry'), view.onRetry),
    ),
  );
}

export function renderReport(root: HTMLElement, report: Report, view: View & { onRerun: () => void; onExport: () => void }): void {
  const { lang } = view;
  const page = el(
    'div',
    { class: 'page' },
    el('div', { class: 'page-title', text: report.title ?? report.url }),
    el('div', { class: 'page-url', text: report.url }),
    el('div', { class: 'page-meta', text: t(lang, 'popup.auditMeta', { time: formatTimestamp(report.timestamp, lang), ms: report.durationMs }) }),
  );
  const rerun = button({ class: 'btn btn-primary', title: t(lang, 'popup.rerunTitle') }, t(lang, 'popup.rerun'), view.onRerun);
  root.replaceChildren(
    header(view, page, rerun),
    el('section', { class: 'gauges' },
      gauge(report.overall, t(lang, 'popup.overall'), lang, true),
      ...report.categories.map((category) => gauge(category.score, category.label, lang)),
    ),
    ...report.categories.map(categorySection),
    el(
      'footer',
      { class: 'footer' },
      el(
        'div',
        { class: 'footer-row' },
        button({ class: 'btn', title: t(lang, 'popup.exportTitle') }, t(lang, 'popup.export'), view.onExport),
        el('span', { class: 'version', text: `Lightfox v${report.version}` }),
      ),
    ),
  );
}
