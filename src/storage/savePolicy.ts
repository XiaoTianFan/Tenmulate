export type SaveDestination = 'browser' | 'project';
// Build mode, not hostname or a successful API probe, owns the boundary.
export const needsSaveDestination = (development: boolean) => development;
export class SaveCancelled extends Error {
  constructor() { super('Save cancelled.'); }
}

export function writeBrowserData(storage: Pick<Storage, 'setItem'>, key: string, value: unknown) {
  try { storage.setItem(key, JSON.stringify(value)); }
  catch { throw new Error('Browser storage is unavailable or full. Nothing was saved. Free storage or allow site storage, then try again.'); }
}
