import type { DrillDefinitionV2, SavedShotV2 } from '../content/types';
import type { CameraPositionPresetV1, PerspectivePresetV1 } from '../storage/appStorage';
import { getLocale, type Locale } from './locale';
import chinese from './content.zh-CN.json';

const messages: Record<string, string> = chinese;
const english = new Map<string, string>();
for (const [key, value] of Object.entries(messages)) {
  if (!english.has(value)) english.set(value, key);
}
export function defaultContentText(value: string, locale: Locale = getLocale()): string {
  return locale === 'zh-CN' ? messages[value] ?? messages[value.toLowerCase()] ?? value : english.get(value) ?? value;
}
/** Call only on project/bundled records, before they become authored drafts. */
export const localizeDefaultDrill = (drill: DrillDefinitionV2, locale: Locale = getLocale()): DrillDefinitionV2 => ({
  ...drill, title: defaultContentText(drill.title, locale), description: defaultContentText(drill.description, locale),
  events: drill.events.map(event => ({ ...event, label: defaultContentText(event.label, locale), cue: defaultContentText(event.cue, locale) })),
});
export const localizeDefaultShot = (shot: SavedShotV2, locale: Locale = getLocale()): SavedShotV2 => ({
  ...shot, name: defaultContentText(shot.name, locale),
  event: { ...shot.event, label: defaultContentText(shot.event.label, locale), cue: defaultContentText(shot.event.cue, locale) },
});
export const localizeDefaultPreset = <T extends CameraPositionPresetV1 | PerspectivePresetV1>(preset: T, locale: Locale = getLocale()): T =>
  ({ ...preset, name: defaultContentText(preset.name, locale) });

/** Explicit browser overrides always win, even if their text matches a default. */
export function localizeDefaults<T extends { id: string }>(items: readonly T[], defaultIds: readonly string[], project: (item: T) => T): T[] {
  const ids = new Set(defaultIds);
  return items.map(item => ids.has(item.id) ? project(item) : item);
}
