import type { Vec3 } from '../../domain/vector';

/** Usable return space in metres, relative to the viewer's position and yaw. */
export type ReturnZone = Readonly<{ forward: number; width: number; depth: number }>;
export const DEFAULT_RETURN_ZONE: ReturnZone = Object.freeze({ forward: 1.2, width: 3, depth: 2 });
export const RETURN_ZONE_RANGES = { forward: [.2, 6], width: [.4, 8], depth: [.2, 6] } as const;
export type ReturnOrigin = Readonly<{ x: number; z: number; yaw?: number }>;
export function returnZonePoint(origin: ReturnOrigin, right: number, forward: number): Vec3 {
  const yaw=(origin.yaw??0)*Math.PI/180;
  return {x:origin.x+right*Math.cos(yaw)+forward*Math.sin(yaw),y:.04,z:origin.z-right*Math.sin(yaw)+forward*Math.cos(yaw)};
}
export function returnZoneMargin(point: Readonly<{x:number;z:number}>, origin: ReturnOrigin, zone: ReturnZone): number {
  const yaw=(origin.yaw??0)*Math.PI/180,dx=point.x-origin.x,dz=point.z-origin.z;
  const right=dx*Math.cos(yaw)-dz*Math.sin(yaw),forward=dx*Math.sin(yaw)+dz*Math.cos(yaw);
  // The near boundary stays in front of the viewer, even for a deep zone.
  return Math.min(zone.width/2-Math.abs(right),forward-Math.max(.05,zone.forward-zone.depth/2),zone.forward+zone.depth/2-forward);
}
export function returnZoneCorners(origin: ReturnOrigin, zone: ReturnZone): readonly Vec3[] {
  const near=Math.max(.05,zone.forward-zone.depth/2),far=zone.forward+zone.depth/2;
  return [[-zone.width/2,near],[zone.width/2,near],[zone.width/2,far],[-zone.width/2,far]].map(([x,z])=>returnZonePoint(origin,x!,z!));
}
