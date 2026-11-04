import { GROUND_KEYS, type CourtLine, type CourtMapping, type ServeSetup } from './types';
import type { CameraControl } from './cameraFit';

export const COURT = {
  halfWidth: 4.115,
  length: 23.77,
  net: 11.885,
  nearService: 5.485,
  farService: 18.285,
  postHeight: 1.07,
  centerHeight: 0.914,
  ballRadius: 0.0335
};
export type CourtControl = CameraControl & { endpoint: number };

/** Enumerate discrete correspondences, not arbitrary cropped fragments. A half
 * has the centre mark/intersection and one singles sideline as its endpoints. */
export function possibleMappings(setup: ServeSetup): CourtMapping[] {
  let variants: CourtMapping[] = [{ halves: {}, supports: {} }];
  for (const key of GROUND_KEYS.filter((key) => setup.lines[key]?.span === 'half'))
    variants = variants.flatMap((mapping) =>
      (['left', 'right'] as const).map((side) => ({
        ...mapping,
        halves: { ...mapping.halves, [key]: side }
      }))
    );
  const posts = (['netA', 'netB'] as const).filter((key) => setup.lines[key]);
  if (posts.length === 2) {
    posts.sort((a, b) => setup.lines[a]!.points[1].x - setup.lines[b]!.points[1].x);
    return variants.map((mapping) => ({ ...mapping, supports: { [posts[0]]: 'left', [posts[1]]: 'right' } }));
  }
  return variants.flatMap((mapping) =>
    (['left', 'right'] as const).map((side) => ({
      ...mapping,
      supports: { [posts[0]]: side }
    }))
  );
}

export function courtControls(setup: ServeSetup, mapping: CourtMapping): CourtControl[] {
  const controls: CourtControl[] = [];
  const add = (mark: CourtLine, endpoint: number, xyz: number[]) => {
    const annotation = setup.lines[mark]!;
    const sigma = Math.max(setup.pixelError, annotation.pixelFloor || 0);
    if (!Number.isFinite(sigma) || sigma > 100)
      throw new Error('Check the measurement uncertainties and physical assumptions.');
    controls.push({ mark, endpoint, point: annotation.points[endpoint], xyz, sigma });
  };
  for (const [key, y] of [
    ['near', 0],
    ['nearService', COURT.nearService],
    ['service', COURT.farService],
    ['far', COURT.length]
  ] as const) {
    if (!setup.lines[key]) continue;
    const side = mapping.halves[key];
    add(key, 0, [side === 'right' ? 0 : -COURT.halfWidth, y, 0]);
    add(key, 1, [side === 'left' ? 0 : COURT.halfWidth, y, 0]);
  }
  const postX = setup.netSupports === 'doubles' ? 6.399 : 5.029;
  for (const key of ['netA', 'netB'] as const) {
    if (!setup.lines[key]) continue;
    const x = (mapping.supports[key] === 'left' ? -1 : 1) * postX;
    add(key, 0, [x, COURT.net, COURT.postHeight]);
    add(key, 1, [x, COURT.net, 0]);
  }
  add('netCenter', 0, [0, COURT.net, COURT.centerHeight]);
  add('netCenter', 1, [0, COURT.net, 0]);
  return controls;
}
