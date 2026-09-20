import { audioRandom } from './acoustics';
import type { SpatialCue } from './spatialCues';

/** Source groups describe the actual recordings; intensity is a ball-speed proxy. */
export class ContactSelector {
  private recent = new Map<number, number[]>();
  reset() { this.recent.clear(); }
  select(cue: SpatialCue, seed: number) {
    const group = cue.family === 'serve' || cue.family === 'overhead' ? 1
      : cue.spin === 'slice' || cue.family === 'volley' || cue.family === 'drop-shot' ? 2 : 0;
    let hash = seed | 0;
    for (const char of cue.id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    const random = audioRandom(hash), recent = this.recent.get(group) ?? [];
    const candidates = [0, 1, 2, 3].map(i => group * 4 + i).filter(i => !recent.includes(i));
    const index = candidates[Math.floor(random() * candidates.length)]!;
    this.recent.set(group, [...recent.slice(-1), index]);
    const intensity = Math.max(0, Math.min(1, ((cue.speedKmh ?? 90) - 30) / 170));
    return { index, rate: .995 + random() * .01, gain: .38 + .62 * Math.sqrt(intensity),
      cutoff: 4200 + 6800 * intensity, decay: .11 + .13 * intensity };
  }
}
