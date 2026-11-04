import { COURT_KEYS, GROUND_KEYS, supportsHalf, type ServeSetup } from './types';

export const markedCourtKeys = (setup: ServeSetup) => COURT_KEYS.filter((key) => !!setup.lines[key]);
export function courtCoverage(setup: ServeSetup) {
  return {
    groundLines: GROUND_KEYS.filter((key) => setup.lines[key]).length,
    netLines: (['netA', 'netB', 'netCenter'] as const).filter((key) => setup.lines[key]).length,
    halfLines: GROUND_KEYS.filter((key) => setup.lines[key]?.span === 'half').length
  };
}
/** Full lines may use any three depths. Half lines need the two full far references. */
export function courtRequirement(setup: ServeSetup): string | undefined {
  if (GROUND_KEYS.some((key) => setup.lines[key]?.span === 'half' && !supportsHalf(key)))
    return 'The far baseline and far service line must use their full singles width.';
  if (courtCoverage(setup).groundLines < 3) return 'Mark at least three of the four court lines.';
  if (courtCoverage(setup).halfLines && (!setup.lines.far || !setup.lines.service))
    return 'Half-line detection needs the full far baseline and far service line.';
  if (!setup.lines.netCenter || (!setup.lines.netA && !setup.lines.netB))
    return 'Mark the net centre and at least one side support, from top to ground.';
}
