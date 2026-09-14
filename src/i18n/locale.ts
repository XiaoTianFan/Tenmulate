import { useSyncExternalStore } from 'react';
import messages from './zh-CN.json';
import diagnostics from './diagnostics.zh-CN.json';

export type Locale = 'en' | 'zh-CN';
export const LANGUAGE_STORAGE_KEY = 'tenmulate.language';
export function detectLocale(languages: readonly string[]): Locale {
  return /^zh(?:-|$)/i.test(languages[0] ?? '') ? 'zh-CN' : 'en';
}
export function initialLocale(storage?: Pick<Storage, 'getItem'>, languages: readonly string[] = []): Locale {
  try { const saved = storage?.getItem(LANGUAGE_STORAGE_KEY); if (saved === 'en' || saved === 'zh-CN') return saved; } catch { /* Use browser preference when storage is blocked. */ }
  return detectLocale(languages);
}
const listeners = new Set<() => void>();
let locale: Locale = 'en';
if (typeof window !== 'undefined') {
  let storage: Storage | undefined;
  try { storage = window.localStorage; } catch { /* Storage may be disabled. */ }
  locale = initialLocale(storage, navigator.languages.length ? navigator.languages : [navigator.language]);
  document.documentElement.lang = locale;
}
export const getLocale = () => locale;
export function setLocale(next: Locale): void {
  locale = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Switching still works for this visit. */ }
  listeners.forEach(listener => listener());
}
export function useLocale(): Locale {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getLocale, () => 'en');
}

const chinese: Record<string, string> = { ...messages, ...diagnostics };
export function translate(message: string, language: Locale, values: Record<string, string | number | undefined> = {}): string {
  const template = language === 'zh-CN' ? chinese[message] ?? message : message;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] === undefined ? match : String(values[key]));
}
/** Translate interface text only. Authored names and descriptions bypass this function. */
export const t = (message: string, values?: Record<string, string | number | undefined>) => translate(message, locale, values);

const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.keys(diagnostics).filter(key => /\{\d+\}/.test(key)).sort((a, b) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length).map(key => ({
  key, slots: [...key.matchAll(/\{(\d+)\}/g)].map(match => match[1]!),
  regex: new RegExp('^' + key.split(/(\{\d+\})/g).map(part => /^\{\d+\}$/.test(part) ? '([\\s\\S]*?)' : escapePattern(part)).join('') + '$'),
}));
/** Boundary adapter for English worker/server diagnostics. Never use on authored content. */
export function message(value: string | null | undefined): string {
  if (!value) return '';
  if (locale === 'en') return value;
  if (chinese[value]) return chinese[value];
  if (value.includes('\n')) return value.split('\n').map(message).join('\n');
  for (const { key, slots, regex } of patterns) {
    const match = value.match(regex);
    if (match) return t(key, Object.fromEntries(slots.map((slot, index) => [slot,
      key === '{0} saved {1}.' || key === '{0} saved in this browser.' ? t(match[index + 1]!) : match[index + 1]!,
    ])));
  }
  if (value.includes(' · ')) return value.split(' · ').map(message).join(' · ');
  return value;
}
