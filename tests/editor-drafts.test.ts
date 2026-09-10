import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { createEditorDraftCache, EDITOR_DRAFT_KEY, reconcileEditorDraft, type EditorDraft } from '../src/storage/editorDrafts';

const draft = (index = 0): EditorDraft => ({ drill: structuredClone(PLAYER_DRILLS[index]!), selectedId: PLAYER_DRILLS[index]!.events[0]!.id,
  overview: true, transitionCamera: { ...PLAYER_DRILLS[index]!.events[0]!.camera, lateral: 2.5, yaw: 12 },
  sections: { 'Drill configuration': true }, inspectorScroll: 170 });
function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
afterEach(() => vi.useRealTimers());
describe('editor draft recovery', () => {
  it('refreshes a clean saved draft from the project while preserving unfinished edits', () => {
    const clean = draft(); clean.savedDrill = structuredClone(clean.drill);
    const external = { ...clean.drill, description: 'Saved by another browser' };
    expect(reconcileEditorDraft(clean, external).drill).toEqual(external);
    const dirty = { ...clean, drill: { ...clean.drill, description: 'My unfinished work' } };
    expect(reconcileEditorDraft(dirty, external)).toEqual(dirty);
  });
  it('retains independent drill edits and restores selected shot, camera, overview and inspector', () => {
    const disk = storage(), cache = createEditorDraftCache(disk), first = draft(), second = draft(1);
    first.drill = { ...first.drill, description: 'Unfinished work' };
    cache.put(first); cache.put(second); cache.flush();
    const reopened = createEditorDraftCache(disk);
    expect(reopened.active()).toEqual(second);
    expect(reopened.get(first.drill.id)).toEqual(first);
    expect(PLAYER_DRILLS[0]!.description).not.toBe(first.drill.description);
  });
  it('retains an empty title and an empty new timeline while editing', () => {
    const disk = storage(), cache = createEditorDraftCache(disk), value = draft();
    value.drill = { ...value.drill, title: ' ', events: [], defaultRepetitions: 1 };
    cache.put(value); cache.flush();
    expect(createEditorDraftCache(disk).active()).toEqual(value);
  });
  it('retains a shot name while the user has cleared it to type a replacement', () => {
    const disk = storage(), cache = createEditorDraftCache(disk), value = draft();
    value.drill = { ...value.drill, events: value.drill.events.map(event => ({ ...event, label: '' })) };
    cache.put(value); cache.flush(); expect(createEditorDraftCache(disk).active()).toEqual(value);
  });
  it('updates memory immediately, debounces disk writes and flushes on navigation', () => {
    vi.useFakeTimers();
    const disk = storage(), cache = createEditorDraftCache(disk), value = draft();
    cache.put(value);
    expect(cache.active()).toEqual(value); expect(disk.getItem(EDITOR_DRAFT_KEY)).toBeNull();
    vi.advanceTimersByTime(250); expect(createEditorDraftCache(disk).active()).toEqual(value);
    value.selectedId = 'launch'; cache.put(value); cache.flush();
    expect(createEditorDraftCache(disk).active()?.selectedId).toBe('launch');
  });
  it('keeps navigation recovery in memory if browser storage is full', () => {
    const cache = createEditorDraftCache({ getItem: () => null, setItem: () => { throw new Error('Quota'); } });
    cache.put(draft()); expect(cache.flush()).toBe(false); expect(cache.active()).toEqual(draft());
  });
  it('rekeys after a same-name save so subsequent edits use the project identity', () => {
    const disk = storage(), cache = createEditorDraftCache(disk), value = draft(); cache.put(value);
    const next = { ...value, drill: { ...value.drill, id: 'canonical-slot' } };
    cache.put(next, value.drill.id); cache.flush();
    expect(cache.get(value.drill.id)).toBeUndefined(); expect(createEditorDraftCache(disk).active()).toEqual(next);
    cache.remove(next.drill.id); expect(createEditorDraftCache(disk).active()).toBeUndefined();
  });
  it('ignores malformed recovery records without damaging good drafts', () => {
    const disk = storage(), good = draft();
    disk.setItem(EDITOR_DRAFT_KEY, JSON.stringify({ version: 1, activeId: 'bad', drafts: { bad: { drill: {} }, [good.drill.id]: good } }));
    const cache = createEditorDraftCache(disk);
    expect(cache.active()).toBeUndefined(); expect(cache.get('bad')).toBeUndefined(); expect(cache.get(good.drill.id)).toEqual(good);
  });
});
