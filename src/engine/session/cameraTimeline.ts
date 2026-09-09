import type { CameraConfiguration } from '../rendering/TennisScene';
import { cameraLookAtCourtPoint, wrapCameraAngle } from '../../domain/camera';
import type { Vec3 } from '../../domain/vector';
import { COURT } from '../../domain/court';
import { cameraEase, interpolateCamera } from './cameraMotion';
import { sampleTennisCamera, type TennisCameraTrack } from './tennisCamera';
export { cameraEase, interpolateCamera } from './cameraMotion';

export const DEFAULT_DRILL_CAMERA: CameraConfiguration = Object.freeze({eyeHeight:1.7,behindBaseline:1.5,lateral:0,yaw:0,pitch:-1.7,fov:70});
export const SHOT_CAMERA_RANGES = {eyeHeight:[1,2.4],behindBaseline:[-10,6],lateral:[-7,7],yaw:[-180,180],pitch:[-85,85],fov:[5,160]} as const;
export type CameraTransition = Readonly<{start:number;end:number;from:CameraConfiguration;to:CameraConfiguration}>;
export type CameraTimeline = Readonly<{initial:CameraConfiguration;transitions:readonly CameraTransition[];tennis?:TennisCameraTrack}>;
export function scaleCameraTimeline(timeline:CameraTimeline,scale:number):CameraTimeline {
  const value=Math.max(0,Math.min(1,scale));
  return timeline.tennis ? {...timeline,tennis:{...timeline.tennis,motionScale:value}} : {...timeline,
    transitions:timeline.transitions.map(stage=>({...stage,from:interpolateCamera(timeline.initial,stage.from,value),to:interpolateCamera(timeline.initial,stage.to,value)}))};
}
const trackingAnchor = (camera:CameraConfiguration) => cameraLookAtCourtPoint(camera,{x:0,y:1.35,z:COURT.halfLength});
const trackingTurnSeconds = (camera:CameraConfiguration):number => {
  const anchor=trackingAnchor(camera);
  return Math.max(.4,1.875*Math.max(Math.abs(wrapCameraAngle(anchor.yaw-camera.yaw)),Math.abs(anchor.pitch-camera.pitch))/110);
};
/** Keep the angular branch fixed throughout a fade, including backward views.
 * Choosing the shortest branch again each frame can flip by 360 degrees. */
const trackingYaw = (reference:CameraConfiguration,lookYaw:number):number => {
  const anchor=trackingAnchor(reference).yaw;
  return reference.yaw+wrapCameraAngle(anchor-reference.yaw)+wrapCameraAngle(lookYaw-anchor);
};
/** Quintic position curve: zero velocity/acceleration at both ends. Constants
 * bound its peak speed/acceleration using the existing virtual-player calibration. */
export function cameraTravelSeconds(from:CameraConfiguration,to:CameraConfiguration,rate=1):number {
  const d=Math.hypot(to.lateral-from.lateral,to.behindBaseline-from.behindBaseline,to.eyeHeight-from.eyeHeight);
  const angle=Math.max(Math.abs(wrapCameraAngle(to.yaw-from.yaw)),Math.abs(to.pitch-from.pitch));
  if(d<1e-7&&angle<1e-7&&Math.abs(to.fov-from.fov)<1e-7)return 0;
  const pace=Math.max(.5,Math.min(1.5,rate));
  const turns=Math.hypot(to.lateral-from.lateral,to.behindBaseline-from.behindBaseline)>.01 ? trackingTurnSeconds(from)+trackingTurnSeconds(to)+.1 : 0;
  return Math.max(.35,turns,1.875*d/Math.min(4.5,3*pace),Math.sqrt(5.774*d/Math.min(5.5,4*pace)),1.875*angle/110,1.875*Math.abs(to.fov-from.fov)/45);
}
export function sampleCameraTimeline(timeline:CameraTimeline,time:number,opponent?:Vec3,aspect=16/9):CameraConfiguration {
  if(timeline.tennis)return sampleTennisCamera(timeline.initial,timeline.transitions,timeline.tennis,time,opponent,aspect);
  let pose=timeline.initial;
  for(const stage of timeline.transitions){
    if(time<stage.start)return pose;
    if(time>=stage.end){pose=stage.to;continue;}
    const duration=stage.end-stage.start,elapsed=time-stage.start,remaining=stage.end-time;
    pose=interpolateCamera(stage.from,stage.to,cameraEase(elapsed/duration));
    if(opponent&&Math.hypot(stage.to.lateral-stage.from.lateral,stage.to.behindBaseline-stage.from.behindBaseline)>.01){
      const look=cameraLookAtCourtPoint(pose,{...opponent,y:1.35});
      const fadeIn=trackingTurnSeconds(stage.from),fadeOut=trackingTurnSeconds(stage.to);
      if(elapsed<fadeIn){
        const weight=cameraEase(elapsed/fadeIn);
        pose={...pose,yaw:wrapCameraAngle(stage.from.yaw+(trackingYaw(stage.from,look.yaw)-stage.from.yaw)*weight),pitch:stage.from.pitch+(look.pitch-stage.from.pitch)*weight};
      }else if(remaining<fadeOut){
        const weight=cameraEase(remaining/fadeOut);
        pose={...pose,yaw:wrapCameraAngle(stage.to.yaw+(trackingYaw(stage.to,look.yaw)-stage.to.yaw)*weight),pitch:stage.to.pitch+(look.pitch-stage.to.pitch)*weight};
      }else pose={...pose,...look};
    }
    return pose;
  }
  return pose;
}
