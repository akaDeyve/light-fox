# Changelog

All notable changes to Lightfox are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ·
Versioning: [Semantic Versioning](https://semver.org/).

## [Unreleased]

Nothing yet.

## [0.1.0] - 2026-11-05 · Early Alpha

First release: a Firefox MV3 extension with Lighthouse-style audits, native to Firefox.
**Early alpha:** the core flow works; edge-case handling is deliberately minimal. Expect bugs
and rough edges. Contributions and ideas are welcome (see *Contributing* in the README).

### Added

- **Performance audits:** TTFB, LCP (via [web-vitals](https://github.com/GoogleChrome/web-vitals)),
  load time, transferred bytes, resource count and DOM size, each scored linearly between
  *good* and *poor* thresholds.
- **Accessibility audits:** axe-core rules tagged WCAG 2.0–2.2 A/AA + `best-practice`, each
  violation with impact, elements, WCAG criteria and rule doc links.
- **Best-practice audits:** HTTPS, meta viewport, standards mode, mixed content, charset,
  obsolete HTML, `rel=noopener`, modern image formats, image aspect ratios, HTTP/2+.
- **Navigation-mode analysis, Lighthouse-style:** every audit reloads the tab without cache,
  waits for the load (max. 30 s) plus 1 s settle time, then measures. Scripts are injected
  only for an analysis, never on normal page visits.
- **Multilingual UI: English (default) and German.** EN/DE switch in the popup, choice
  remembered. The content script returns language-neutral raw data; the background caches the
  measurement (5 min) and scores it per request in the requested language, so switching
  languages re-scores without a reload.
- Popup with score rings, expandable audits, category details and JSON export; UI in
  Firefox's new **Nova** design (light and dark).
- Overall score: performance 40 %, accessibility 40 %, best practices 20 %.
- Build via a single direct esbuild call (`scripts/build.mjs`); `npm run check` =
  typecheck + tests + `web-ext lint`; icon generation via `npm run icons`.
- Documentation: bilingual README (EN/DE) with quick start, architecture, audit tables,
  Lighthouse comparison, TODO and roadmap.

### Removed (alpha simplifications)

- **CLS and INP** for now: Firefox does not implement the Layout Instability API (CLS was
  always n/a), and INP needs a user interaction, which never happens right after the reload.
  Re-adding them is a TODO (roadmap stage 2).
- axe runs by tag (`runOnly: tag`), so the 9 rules axe disables by default no longer run
  (100 → 91 rules).
- Edge-case handling (audit timeout bookkeeping, per-metric n/a reasons, localhost/HTTPS and
  viewport special cases) removed in favour of a small, working core.
