import type { SpinKind } from '../engine/trajectory/physics.ts';

export const SHOT_TYPE_LABELS = {
  groundstroke: 'Groundstroke', serve: 'Serve', 'drop-shot': 'Drop shot',
  volley: 'Volley', overhead: 'Overhead', lob: 'Lob', approach: 'Approach', 'half-volley': 'Half-volley',
} as const;
export const spinsForShot = (family: string): readonly SpinKind[] => family === 'serve'
  ? ['flat', 'topspin', 'slice', 'kick', 'sidespin'] : ['topspin', 'flat', 'slice'];

/** Preserve old documents without applying serve-only spin axes to rally balls. */
export const normalizeShotSpin = (family: string, spin: SpinKind): SpinKind => family === 'serve' ? spin
  : spin === 'kick' ? 'topspin' : spin === 'sidespin' ? 'slice' : spin;
