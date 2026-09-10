import type { DrillDefinitionV2 } from '../content/types';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import { validatePlayerDrill } from '../content/playerValidation';
import { SHOT_CAMERA_RANGES } from '../engine/session/cameraTimeline';

export const EDITOR_DRAFT_KEY = 'tenmulate.editorDrafts.v1';
export type EditorDraft = {
  drill: DrillDefinitionV2;
  savedDrill?: DrillDefinitionV2;
  selectedId: string;
  overview: boolean;
  transitionCamera: CameraConfiguration | null;
  sections?: Record<string, boolean>;
  inspectorScroll?: number;
};
type DraftCacheData = { version: 1; activeId: string | null; drafts: Record<string, EditorDraft> };

/** A clean recovery snapshot must not conceal a newer project save from another browser. */
export function reconcileEditorDraft(draft: EditorDraft, projectDrill?: DrillDefinitionV2): EditorDraft {
  return projectDrill && draft.savedDrill && JSON.stringify(draft.drill) === JSON.stringify(draft.savedDrill)
    ? { ...draft, drill: projectDrill, savedDrill: projectDrill } : draft;
}

function isDraft(value: unknown): value is EditorDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as EditorDraft, drill = draft.drill;
  if (!drill || typeof drill.title !== 'string' || drill.title.length > 100 || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(drill.id)
    || !Array.isArray(drill.events) || drill.events.length > 200 || typeof draft.selectedId !== 'string' || typeof draft.overview !== 'boolean') return false;
  if (draft.transitionCamera !== null && (!draft.transitionCamera || Object.entries(SHOT_CAMERA_RANGES).some(([key, [min, max]]) => {
    const value = draft.transitionCamera?.[key as keyof CameraConfiguration];
    return typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max;
  }))) return false;
  if (draft.sections !== undefined && (!draft.sections || typeof draft.sections !== 'object' || Object.values(draft.sections).some(value => typeof value !== 'boolean'))) return false;
  // Empty titles and timelines are legitimate unfinished edits, never publishable saves.
  const errors = validatePlayerDrill({ ...drill, title: drill.title.trim() ? drill.title : 'Untitled draft',
    events: drill.events.map(event => event && typeof event.label === 'string' && !event.label.trim() ? { ...event, label: 'Untitled shot' } : event) }).errors;
  return errors.every(error => error === 'A drill needs 1–200 player shots.' && drill.events.length === 0);
}

export function createEditorDraftCache(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  let data: DraftCacheData = { version: 1, activeId: null, drafts: {} }, timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const parsed = JSON.parse(storage?.getItem(EDITOR_DRAFT_KEY) ?? 'null');
    if (parsed?.version === 1 && parsed.drafts && typeof parsed.drafts === 'object') {
      for (const [id, draft] of Object.entries(parsed.drafts)) if (isDraft(draft) && draft.drill.id === id) data.drafts[id] = draft;
      data.activeId = Object.hasOwn(data.drafts, parsed.activeId) ? parsed.activeId : null;
    }
  } catch { /* Broken recovery data must not prevent opening the project. */ }
  const flush = () => {
    clearTimeout(timer);
    try { storage?.setItem(EDITOR_DRAFT_KEY, JSON.stringify(data)); return true; }
    catch { return false; } // The live in-memory draft still survives navigation.
  };
  return {
    get: (id: string) => Object.hasOwn(data.drafts, id) ? data.drafts[id] : undefined,
    active: () => data.activeId ? data.drafts[data.activeId] : undefined,
    put: (draft: EditorDraft, previousId?: string) => {
      if (previousId && previousId !== draft.drill.id) delete data.drafts[previousId];
      data.drafts[draft.drill.id] = draft; data.activeId = draft.drill.id;
      clearTimeout(timer); timer = setTimeout(flush, 250);
    },
    remove: (id: string) => { delete data.drafts[id]; if (data.activeId === id) data.activeId = null; flush(); },
    flush,
  };
}
