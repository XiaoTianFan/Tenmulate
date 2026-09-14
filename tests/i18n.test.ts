import { afterEach, describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import { readFileSync, readdirSync } from 'node:fs';
import { detectLocale, initialLocale, LANGUAGE_STORAGE_KEY, message, setLocale, t, translate } from '../src/i18n/locale';
import { defaultContentText, localizeDefaultDrill, localizeDefaultPreset, localizeDefaults, localizeDefaultShot } from '../src/i18n/content';
import zh from '../src/i18n/zh-CN.json';
import diagnostics from '../src/i18n/diagnostics.zh-CN.json';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { DEFAULT_CAMERA_POSITION_PRESETS, DEFAULT_PERSPECTIVE_PRESETS } from '../src/storage/appStorage';
import projectDrills from '../src/content/project-drills.json';
import projectShots from '../src/content/project-shots.json';
import projectConfigs from '../src/content/project-configs.json';
import { defaultDrillSettings } from '../src/app/defaults';
import { compileSession } from '../src/engine/session/compileSession';

afterEach(() => setLocale('en'));
const translations: Record<string, string> = { ...zh, ...diagnostics };
const placeholders = (value: string) => [...value.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
function walk(value: unknown, visit: (node: Record<string, unknown>) => void) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(item => walk(item, visit)); return; }
  visit(value as Record<string, unknown>);
  Object.values(value).forEach(item => walk(item, visit));
}

describe('language preference and messages', () => {
  it.each(['zh', 'zh-CN', 'zh-TW', 'zh-HK', 'ZH-hans'])('detects Chinese browser language %s', language => {
    expect(detectLocale([language, 'en'])).toBe('zh-CN');
  });
  it('uses the primary browser language and gives explicit preference priority', () => {
    expect(detectLocale(['en-US', 'zh-CN'])).toBe('en');
    expect(detectLocale(['fr', 'zh'])).toBe('en');
    expect(detectLocale([])).toBe('en');
    expect(initialLocale({ getItem: key => key === LANGUAGE_STORAGE_KEY ? 'en' : null }, ['zh'])).toBe('en');
    expect(initialLocale({ getItem: () => 'zh-CN' }, ['en'])).toBe('zh-CN');
    expect(initialLocale({ getItem: () => 'invalid' }, ['zh'])).toBe('zh-CN');
    expect(initialLocale({ getItem: () => { throw new Error('blocked'); } }, ['zh'])).toBe('zh-CN');
  });
  it('changes fixed UI while keeping interpolated user content exact', () => {
    setLocale('zh-CN');
    expect(t('Save drill')).toBe('保存训练');
    expect(t('Saved “{0}”.', { 0: 'Practice <中文>' })).toBe('已保存“Practice <中文>”。');
    expect(message('Saved “Practice”.')).toBe('已保存“Practice”。');
    expect(message('Event 3 cue must be 60 characters or fewer.')).toBe('事件 3 的提示不能超过 60 个字符。');
    expect(message('Save failed.\nImport failed.')).toBe('保存失败。\n导入失败。');
    expect(translate('Save drill', 'en')).toBe('Save drill');
    expect(message('Unknown third-party detail')).toBe('Unknown third-party detail');
  });
  it('keeps every translation nonempty with matching interpolation slots', () => {
    for (const [key, value] of Object.entries(translations)) {
      expect(value.trim(), key).not.toBe('');
      expect(placeholders(value), key).toEqual(placeholders(key));
    }
  });
});

describe('default content and authored data', () => {
  it('translates project content without changing the source or authored overrides', () => {
    const source = PLAYER_DRILLS[0]!, snapshot = JSON.stringify(source);
    const custom = { ...source, id: 'custom-one', title: 'Crosscourt Rhythm', description: 'My 中文 notes' };
    const result = localizeDefaults([source, custom], [source.id], item => localizeDefaultDrill(item, 'zh-CN'));
    expect(result[0]!.title).toBe('斜线对拉节奏');
    expect(result[0]!.events[0]!.label).toBe('正手深斜线');
    expect(result[0]!.events[0]!.cue).toBe('正手深斜线');
    expect(result[1]).toBe(custom);
    expect(JSON.stringify(source)).toBe(snapshot);
    expect(localizeDefaults([custom], [], item => localizeDefaultDrill(item, 'zh-CN'))[0]).toBe(custom);
    const preset = DEFAULT_CAMERA_POSITION_PRESETS[0]!;
    expect(localizeDefaultPreset(preset, 'zh-CN').name).toBe('底线');
    expect(defaultContentText('底线', 'en')).toBe('Baseline');
    expect(defaultContentText(localizeDefaultDrill(source, 'zh-CN').title, 'en')).toBe(source.title);
    expect(localizeDefaults([preset], [], item => localizeDefaultPreset(item, 'zh-CN'))[0]!.name).toBe('Baseline');
    const shot = { schemaVersion: 2 as const, id: 'default-shot', name: source.events[0]!.label, event: source.events[0]! };
    expect(localizeDefaultShot(shot, 'zh-CN').name).toBe('正手深斜线');
    expect(localizeDefaults([shot], [], item => localizeDefaultShot(item, 'zh-CN'))[0]).toBe(shot);
  });
  it('covers shipped project and fallback content', () => {
    const missing = new Set<string>();
    walk([projectDrills, projectShots, projectConfigs, PLAYER_DRILLS, DEFAULT_CAMERA_POSITION_PRESETS, DEFAULT_PERSPECTIVE_PRESETS], node => {
      for (const key of ['title', 'description', 'name', 'label', 'cue']) {
        const value = node[key];
        if (typeof value === 'string' && /[A-Za-z]/.test(value) && defaultContentText(value, 'zh-CN') === value) missing.add(value);
      }
    });
    expect([...missing]).toEqual([]);
  });
  it('keeps shot physics and clocks identical in both languages', () => {
    const drill = PLAYER_DRILLS[1]!, settings = defaultDrillSettings(drill, undefined, undefined, undefined, { repetitions: 1, restSeconds: 0 });
    const english = compileSession(drill, settings), chinese = compileSession(localizeDefaultDrill(drill, 'zh-CN'), settings);
    expect(chinese.duration).toBe(english.duration);
    expect(chinese.scheduledFlights).toEqual(english.scheduledFlights);
    expect(chinese.cameraTimeline).toEqual(english.cameraTimeline);
    expect(chinese.planningIssues).toEqual([]);
  });
});

it('covers fixed JSX text and every literal translation key', () => {
  const files = readdirSync('src/components').filter(file => file.endsWith('.tsx')).map(file => `src/components/${file}`)
    .concat('src/app/App.tsx', 'src/hooks/useSaveSystem.tsx');
  const missing: string[] = [];
  for (const file of files) {
    walk(parse(readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] }), node => {
      if (node.type === 'CallExpression' && (node.callee as { name?: string })?.name === 't') {
        const first = (node.arguments as { type: string; value: string }[])[0];
        if (first?.type === 'StringLiteral' && !translations[first.value]) missing.push(`${file}: ${first.value}`);
      }
      if (node.type === 'JSXText') {
        const value = String(node.value).replace(/\s+/g, ' ').trim();
        if (/[A-Za-z]/.test(value) && !['Tenmulate', 'English', 'Xiaotian Fan (GleeGen)'].includes(value)) missing.push(`${file}: bare text ${value}`);
      }
    });
  }
  expect(missing).toEqual([]);
});
