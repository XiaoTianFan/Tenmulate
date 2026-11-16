import { COURT_KEYS, GROUND_KEYS, type ServeSetup } from './types';

export const markedCourtKeys = (setup: ServeSetup) => COURT_KEYS.filter((key) => !!setup.lines[key]);
export function courtCoverage(setup: ServeSetup) {
  return {
    groundLines: GROUND_KEYS.filter((key) => setup.lines[key]).length + Number(!!setup.lines.nearCenter),
    netLines: (['netA', 'netB', 'netCenter'] as const).filter((key) => setup.lines[key]).length,
    halfLines: GROUND_KEYS.filter((key) => setup.lines[key]?.span === 'half').length
  };
}
/** Sparse evidence needs metric camera assumptions when a second elevated point
 * or a full-width ground reference is absent. Rich mappings retain the full fit. */
export const usesReducedCamera = (setup: ServeSetup) =>
  !!setup.lines.nearCenter &&
  ((!setup.lines.netA && !setup.lines.netB) ||
    !GROUND_KEYS.some((key) => setup.lines[key] && setup.lines[key]!.span !== 'half'));

/** Coverage permits fitting; it does not establish uniqueness or accuracy. */
export function courtRequirement(setup: ServeSetup): string | undefined {
  if (setup.lines.nearCenter?.span === 'half')
    return 'Mark the complete near centre service line, from the service-line intersection to the ground beneath the net centre.';
  const transverse = GROUND_KEYS.filter((key) => setup.lines[key]);
  const centreReference = !!setup.lines.nearCenter && transverse.length > 0;
  if (transverse.length < 3 && !centreReference)
    return 'Mark the near centre service line, far baseline and another baseline or service line, or three cross-court lines.';
  if (usesReducedCamera(setup) && (!setup.lines.far || transverse.length < 2))
    return 'Reduced mapping needs the far baseline and one other baseline or service line. Half or full widths are supported.';
  if (
    courtCoverage(setup).halfLines &&
    !centreReference &&
    (!setup.lines.far ||
      setup.lines.far.span === 'half' ||
      !setup.lines.service ||
      setup.lines.service.span === 'half')
  )
    return 'Half-line detection needs the near centre service line or both full far reference lines.';
  if (!setup.lines.netCenter) return 'Mark the net centre from top to ground.';
  if (!centreReference && !setup.lines.netA && !setup.lines.netB)
    return 'Mark the net centre and at least one side support, from top to ground.';
}
