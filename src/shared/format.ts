/** Sprachabhängige Zahlen-/Zeitformatierung (Intl). Bytes dezimal (kB/MB), passend zu den Schwellwerten. */

import type { Lang } from './i18n';

const LOCALES: Record<Lang, string> = { en: 'en-US', de: 'de-DE' };

export function formatNumber(value: number, lang: Lang, maximumFractionDigits = 0): string {
  return value.toLocaleString(LOCALES[lang], { maximumFractionDigits });
}

function formatUnit(value: number, unit: string, lang: Lang, maximumFractionDigits = 0): string {
  return value.toLocaleString(LOCALES[lang], { style: 'unit', unit, maximumFractionDigits });
}

export function formatMs(ms: number, lang: Lang): string {
  return ms < 1000 ? formatUnit(ms, 'millisecond', lang) : formatUnit(ms / 1000, 'second', lang, 2);
}

export function formatBytes(bytes: number, lang: Lang): string {
  return bytes < 1_000_000 ? formatUnit(bytes / 1000, 'kilobyte', lang) : formatUnit(bytes / 1_000_000, 'megabyte', lang, 1);
}

export function formatTimestamp(ts: number, lang: Lang): string {
  return new Date(ts).toLocaleString(LOCALES[lang], { dateStyle: 'short', timeStyle: 'medium' });
}
