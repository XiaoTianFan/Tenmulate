/** Published only when a decoded picture has actually been drawn/revealed. */
export class PresentedFrames {
  private frames = new Map<string, number>();
  private listeners = new Map<string, Set<() => void>>();
  get = (id: string) => this.frames.get(id) ?? -1;
  subscribe(id: string, listener: () => void) {
    const listeners = this.listeners.get(id) ?? new Set(); this.listeners.set(id, listeners); listeners.add(listener);
    return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(id); };
  }
  present(id: string, frame: number) {
    if (this.frames.get(id) === frame) return;
    this.frames.set(id, frame); for (const listener of this.listeners.get(id) ?? []) listener();
  }
  remove(id: string) { this.frames.delete(id); this.listeners.delete(id); }
}
