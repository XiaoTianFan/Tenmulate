import type { CameraConfiguration } from '../rendering/TennisScene';
import { cameraLookAtCourtPoint, wrapCameraAngle } from '../../domain/camera';
import type { Vec3 } from '../../domain/vector';

export const DEFAULT_DRILL_CAMERA: CameraConfiguration = Object.freeze({eyeHeight:1.7,behindBaseline:1.5,lateral:0,yaw:0,pitch:-1.7,fov:70});
export const SHOT_CAMERA_RANGES = {eyeHeight:[1,2.4],behindBaseline:[-10,6],lateral:[-7,7],yaw:[-180,180],pitch:[-85,85],fov:[5,160]} as const;
export type CameraTransition = Readonly<{start:number;end:number;from:CameraConfiguration;to:CameraConfiguration}>;
export type CameraTimeline = Readonly<{initial:CameraConfiguration;transitions:readonly CameraTransition[]}>;
export const cameraEase = (value:number):number => {const t=Math.max(0,Math.min(1,value));return t*t*t*(10+t*(-15+6*t));};
export function interpolateCamera(from:CameraConfiguration,to:CameraConfiguration,t:number):CameraConfiguration {
  const lerp=(a:number,b:number)=>a+(b-a)*t;
  return {eyeHeight:lerp(from.eyeHeight,to.eyeHeight),lateral:lerp(from.lateral,to.lateral),behindBaseline:lerp(from.behindBaseline,to.behindBaseline),
    yaw:wrapCameraAngle(from.yaw+wrapCameraAngle(to.yaw-from.yaw)*t),pitch:lerp(from.pitch,to.pitch),fov:lerp(from.fov,to.fov)};
}
/** Quintic position curve: zero velocity/acceleration at both ends. Constants
 * bound its peak speed/acceleration using the existing virtual-player calibration. */
export function cameraTravelSeconds(from:CameraConfiguration,to:CameraConfiguration,rate=1):number {
  const d=Math.hypot(to.lateral-from.lateral,to.behindBaseline-from.behindBaseline,to.eyeHeight-from.eyeHeight);
  const angle=Math.max(Math.abs(wrapCameraAngle(to.yaw-from.yaw)),Math.abs(to.pitch-from.pitch));
  if(d<1e-7&&angle<1e-7&&Math.abs(to.fov-from.fov)<1e-7)return 0;
  const pace=Math.max(.5,Math.min(1.5,rate));
  return Math.max(.35,1.875*d/Math.min(4.5,3*pace),Math.sqrt(5.774*d/Math.min(5.5,4*pace)),1.875*angle/110,1.875*Math.abs(to.fov-from.fov)/45);
}
export function sampleCameraTimeline(timeline:CameraTimeline,time:number,opponent?:Vec3):CameraConfiguration {
  let pose=timeline.initial;
  for(const stage of timeline.transitions){
    if(time<stage.start)return pose;
    if(time>=stage.end){pose=stage.to;continue;}
    const duration=stage.end-stage.start,elapsed=time-stage.start,remaining=stage.end-time;
    pose=interpolateCamera(stage.from,stage.to,cameraEase(elapsed/duration));
    if(opponent&&Math.hypot(stage.to.lateral-stage.from.lateral,stage.to.behindBaseline-stage.from.behindBaseline)>.01){
      const fade=Math.min(.4,duration*.3),weight=cameraEase(elapsed/fade)*cameraEase(remaining/fade);
      const look=cameraLookAtCourtPoint(pose,{...opponent,y:1.35});
      pose={...pose,yaw:wrapCameraAngle(pose.yaw+wrapCameraAngle(look.yaw-pose.yaw)*weight),pitch:pose.pitch+(look.pitch-pose.pitch)*weight};
    }
    return pose;
  }
  return pose;
}
