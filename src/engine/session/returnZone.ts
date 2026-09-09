/** Legacy schema-v1 calibration. Import validation only; gameplay now uses
 * per-event opponent-side returnLandingZone coordinates. */
export type ReturnZone = Readonly<{ forward: number; width: number; depth: number }>;
export const RETURN_ZONE_RANGES = { forward: [.2, 6], width: [.4, 8], depth: [.2, 6] } as const;
