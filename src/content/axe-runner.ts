/**
 * axe-core-Runner (Content-Script).
 * axe wird vom Background als unverändertes axe.min.js injiziert und läuft im selben
 * Sandbox-Kontext wie dieses Content-Script (window.axe). Bewusst ohne axe.configure():
 * Locale-Texte würden per new Function() kompiliert und an strikten CSPs scheitern –
 * deutsche Texte setzt deshalb das Scoring im Background ein.
 *
 * Quellen:
 * - axe-core API: https://github.com/dequelabs/axe-core/blob/develop/doc/API.md
 * - Regel-Tags: https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md
 */

import type Axe from 'axe-core';
import type { A11yPayload } from '../shared/types';

/** WCAG-Regeln (A/AA, inkl. WCAG 2.1/2.2) plus axe-Best-Practice-Regeln. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice'];
const MAX_NODES_PER_RULE = 20;
const MAX_HTML_LENGTH = 300;

export async function runAxe(): Promise<A11yPayload> {
  try {
    const axe = (window as { axe?: typeof Axe }).axe;
    if (!axe) throw new Error('axe-core not injected');
    const results = await axe.run(document, { runOnly: { type: 'tag', values: TAGS }, iframes: false });
    return {
      error: null,
      ruleCount: results.passes.length + results.violations.length + results.incomplete.length + results.inapplicable.length,
      passCount: results.passes.length,
      violations: results.violations.map((violation) => ({
        id: violation.id,
        help: violation.help,
        helpUrl: violation.helpUrl,
        impact: violation.impact ?? null,
        tags: violation.tags,
        nodes: violation.nodes.slice(0, MAX_NODES_PER_RULE).map((node) => ({
          target: node.target.join(' > '),
          html: node.html.trim().slice(0, MAX_HTML_LENGTH),
        })),
      })),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), ruleCount: 0, passCount: 0, violations: [] };
  }
}
