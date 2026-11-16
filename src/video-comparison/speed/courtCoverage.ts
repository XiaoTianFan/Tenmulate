import { COURT_KEYS, GROUND_KEYS, supportsHalf, type ServeSetup } from './types';

export const markedCourtKeys = (setup: ServeSetup) => COURT_KEYS.filter((key) => !!setup.lines[key]);
export function courtCoverage(setup: ServeSetup) {
  return {
    groundLines: GROUND_KEYS.filter((key) => setup.lines[key]).length + Number(!!setup.lines.nearCenter),
    netLines: (['netA', 'netB', 'netCenter'] as const).filter((key) => setup.lines[key]).length,
    halfLines: GROUND_KEYS.filter((key) => setup.lines[key]?.span === 'half').length
  };
}
/** A complete centre segment plus a full-width line supplies independent ground
 * controls with the net feet. It also anchors half-line side inference; without
 * it, half lines keep the existing two-full-far-reference requirement.
 * Coverage only permits fitting; rank, residuals and sensitivity still gate speed. */
export function courtRequirement(setup: ServeSetup): string | undefined {
  if (GROUND_KEYS.some((key) => setup.lines[key]?.span === 'half' && !supportsHalf(key)))
    return 'The far baseline and far service line must use their full singles width.';
  if (setup.lines.nearCenter?.span === 'half')
    return 'Mark the complete near centre service line, from the service-line intersection to the ground beneath the net centre.';
  const transverse = GROUND_KEYS.filter((key) => setup.lines[key]);
  const centreReference = !!setup.lines.nearCenter &&
    transverse.some((key) => setup.lines[key]!.span !== 'half');
  if (transverse.length < 3 && !centreReference)
    return 'Mark three cross-court lines, or the near centre service line and one full-width court line.';
  if (courtCoverage(setup).halfLines && !centreReference && (!setup.lines.far || !setup.lines.service))
    return 'Half-line detection needs the full far baseline and far service line.';
  if (!setup.lines.netCenter || (!setup.lines.netA && !setup.lines.netB))
    return 'Mark the net centre and at least one side support, from top to ground.';
}
