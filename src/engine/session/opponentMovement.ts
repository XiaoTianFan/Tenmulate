import library from '../../content/opponent-motion.json';
import type { Vec3 } from '../../domain/vector';
import type { MotionEvent, MotionId, MotionSample } from './opponentTimeline';

export const MAX_OPPONENT_SPEED = 7.2;
export const MAX_TRAVEL_ACCELERATION = 12;
export const SPLIT_SECONDS = .6;
const clamp = (x:number) => Math.max(0,Math.min(1,x));
const ease = (x:number) => { x=clamp(x);return x*x*(3-2*x); };
const mix = (a:number,b:number,t:number) => a+(b-a)*t;
const point = (a:Vec3,b:Vec3,t:number):Vec3 => ({x:mix(a.x,b.x,t),y:0,z:mix(a.z,b.z,t)});
const distance = (a:Vec3,b:Vec3) => Math.hypot(a.x-b.x,a.z-b.z);
const yawMix = (a:number,b:number,t:number) => a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
export type MovementStage = 'recover'|'split'|'approach'|'ready'|'drill';
export type TravelLeg = Readonly<{from:Vec3;to:Vec3;start:number;end:number;fromYaw:number;toYaw:number;stage:MovementStage;crossover?:boolean;clip?:MotionId;arrival?:MotionEvent}>;
export type RecoveryPlan = Readonly<{kind:'recovery'|'direct';center:Vec3;recover:TravelLeg;approach:TravelLeg|null;splitStart:number;splitEnd:number;end:number;requiredDuration:number}>;
const entrySpec = (event?: MotionEvent) => event?.entryTime ? (library.clips[event.clip] as {preparedEntry?:{time:number;blendSeconds:number}}).preparedEntry : undefined;
const entryCorrection = (event: MotionEvent, localTime=event.entryTime??0) => {
  const clip=library.clips[event.clip];
  return (event.source.y-clip.contactLocal[1]*library.scale-library.floorOffset)*ease(localTime/clip.contact);
};

/** Integrate a speed profile with separate push-off, cruise and braking phases.
 * Both velocity and acceleration vanish at the endpoints; seeks are stateless. */
export function travelCurve(u:number): {progress:number;velocity:number;acceleration:number} {
  u=clamp(u); const a=.26,b=.34,peak=1/(1-(a+b)/2);
  if(u<a)return {progress:peak/2*(u-a/Math.PI*Math.sin(Math.PI*u/a)),
    velocity:peak/2*(1-Math.cos(Math.PI*u/a)),acceleration:peak*Math.PI/(2*a)*Math.sin(Math.PI*u/a)};
  if(u<=1-b)return {progress:peak*(u-a/2),velocity:peak,acceleration:0};
  const q=(u-1+b)/b;
  return {progress:peak*(1-b-a/2)+peak*b/2*(q+Math.sin(Math.PI*q)/Math.PI),
    velocity:peak/2*(1+Math.cos(Math.PI*q)),acceleration:-peak*Math.PI/(2*b)*Math.sin(Math.PI*q)};
}
export function travelDuration(from:Vec3,to:Vec3,pace=MAX_OPPONENT_SPEED,acceleration=MAX_TRAVEL_ACCELERATION):number {
  const d=distance(from,to);
  return d<.015?0:Math.max(.3,d/(.7*pace),Math.sqrt(Math.PI*d/(1.4*.26*acceleration)));
}
export function recoveryCenter(event:MotionEvent):Vec3 {
  if(event.home)return event.home;
  const baseline=event.root.z>=11.5;
  const side=Math.abs(event.source.x)>.4?Math.sign(event.source.x):(event.hand==='right'?1:-1);
  return {x:side*.55,y:0,z:baseline?13.385:Math.max(3.2,event.root.z)};
}
export function planRecovery(previous:MotionEvent,next?:MotionEvent):RecoveryPlan {
  const center=recoveryCenter(previous);
  const availableTime=next?next.start-previous.end:Infinity;
  const rate=Math.min(3,Math.max(.5,previous.movementRate??1));
  const splitSeconds=SPLIT_SECONDS/rate;
  const arrival=entrySpec(next)?next:undefined;
  const legTime=(from:Vec3,to:Vec3,rate:number,fromYaw:number,toYaw:number)=>{
    const turn=Math.abs(Math.atan2(Math.sin(toYaw-fromYaw),Math.cos(toYaw-fromYaw)));
    return Math.max(travelDuration(from,to,Math.min(MAX_OPPONENT_SPEED,3.2*rate),Math.min(MAX_TRAVEL_ACCELERATION,4.4*rate)),turn>1e-4?Math.max(.18/rate,turn/(2*Math.min(2,rate))):0);
  };
  const serveApproach=next&&previous.clip.startsWith('serve')&&previous.tossEnabled!==false&&next.root.z<previous.root.z-3;
  const approachDuration=(from:Vec3,rate:number,fromYaw:number)=>next?Math.max(legTime(from,next.root,rate,fromYaw,next.yaw),(entrySpec(next)?.blendSeconds??0)/next.rate):0;
  const fullAt=(rate:number)=>legTime(previous.root,center,rate,previous.yaw,Math.PI)+splitSeconds+approachDuration(center,rate,Math.PI);
  const direct=!!next&&(previous.recoveryPolicy==='direct'||previous.recoveryPolicy==='auto'&&(serveApproach||availableTime+1e-7<fullAt(rate)));
  const recoverTime=legTime(previous.root,center,rate,previous.yaw,Math.PI);
  const approachTime=approachDuration(center,rate,Math.PI);
  const requiredDuration=recoverTime+splitSeconds+approachTime;
  const start=previous.end,available=next?next.start-start:requiredDuration;
  if(direct&&next){
    const travel=approachDuration(previous.root,rate,previous.yaw),end=start+Math.max(travel,available);
    // Arrive exactly as the stroke starts. Serve-and-volley departs immediately;
    // other direct routes can wait in ready before the final approach.
    const leg:TravelLeg={from:previous.root,to:next.root,start:serveApproach?start:end-travel,end,fromYaw:previous.yaw,toYaw:next.yaw,stage:'approach',arrival};
    return {kind:'direct',center:next.root,recover:leg,approach:null,splitStart:end,splitEnd:end,
      end,requiredDuration:travel};
  }
  // Compilation must reserve this full duration before assigning contact times.
  // The planner never shortens travel to fit an infeasible input schedule.
  const end=start+Math.max(requiredDuration,available);
  const splitEnd=next?end-approachTime:start+recoverTime+splitSeconds;
  return {kind:'recovery',center,requiredDuration,end,
    recover:{from:previous.root,to:center,start,end:start+recoverTime,fromYaw:previous.yaw,toYaw:Math.PI,stage:'recover',crossover:Math.abs(previous.root.x-center.x)>1.4},
    splitStart:splitEnd-splitSeconds,splitEnd,
    approach:next?{from:center,to:next.root,start:splitEnd,end:splitEnd+approachTime,fromYaw:Math.PI,toYaw:next.yaw,stage:'approach',arrival}:null};
}

function rest(root:Vec3,yaw:number,hand:'left'|'right',stage:MovementStage,time=0,split=false):MotionSample {
  return {root,yaw,hand,event:null,verticalCorrection:0,toss:null,movement:{stage,speed:0,distance:0,phase:0,heading:yaw},
    layers:[{clip:split?'split-step':'ready',time:split?clamp(time/SPLIT_SECONDS)*library.clips['split-step'].duration:0,weight:1}]};
}

function arrivalRest(leg:TravelLeg,hand:'left'|'right'):MotionSample {
  const event=leg.arrival;
  return event?{...rest(leg.to,leg.toYaw,hand,'approach'),verticalCorrection:entryCorrection(event),
    layers:[{clip:event.clip,time:event.entryTime!,weight:1}]}:rest(leg.to,leg.toYaw,hand,'ready');
}

/** A pure distance clock makes cadence follow travel speed and survives seeks.
 * Plant positions are derived from route distance, never previous frame state. */
export function sampleTravel(leg:TravelLeg,time:number,hand:'left'|'right'):MotionSample {
  const d=distance(leg.from,leg.to),duration=leg.end-leg.start;
  if(duration<=0)return arrivalRest(leg,hand);
  if(d<.015){
    const progress=ease((time-leg.start)/duration),sample=rest(point(leg.from,leg.to,progress),yawMix(leg.fromYaw,leg.toYaw,progress),hand,leg.stage);
    // A route can become a turn in place after scheduling. Still finish its
    // reserved preparation instead of snapping from ready at the boundary.
    const event=leg.arrival;
    const localTime=event?Math.max(0,event.entryTime!-(leg.end-time)*event.rate):0;
    return event?{...sample,verticalCorrection:entryCorrection(event,localTime)*progress,layers:[
      {clip:'ready',time:0,weight:1-progress},{clip:event.clip,time:localTime,weight:progress}]}:sample;
  }
  const u=clamp((time-leg.start)/duration),curve=travelCurve(u),progress=curve.progress,covered=d*progress;
  const speed=curve.velocity*d/duration,acceleration=curve.acceleration*d/(duration*duration),root=point(leg.from,leg.to,progress);
  const heading=Math.atan2(leg.to.x-leg.from.x,leg.to.z-leg.from.z);
  const peakSpeed=d/(.7*duration);
  const running=leg.clip==='run-forward'||!leg.clip&&d>=1.1&&peakSpeed>2.25;
  const walking=leg.clip==='walk-forward'||!leg.clip&&!running&&d>=.65;
  const travelTurn=running||walking;
  const elapsed=time-leg.start,remaining=leg.end-time;
  const cross=!!leg.crossover&&duration>1.2;
  const turnIn=cross?.45:0,turnDuration=Math.min(.48,duration*.26);
  const yaw=travelTurn?yawMix(yawMix(leg.fromYaw,heading,ease((elapsed-turnIn)/turnDuration)),leg.toYaw,ease((turnDuration-remaining)/turnDuration)):yawMix(leg.fromYaw,leg.toYaw,progress);
  const lx=(leg.to.x-leg.from.x)*Math.cos(yaw)-(leg.to.z-leg.from.z)*Math.sin(yaw);
  const lz=(leg.to.x-leg.from.x)*Math.sin(yaw)+(leg.to.z-leg.from.z)*Math.cos(yaw);
  const mirror=hand==='left'?-1:1;
  const localRight=(leg.to.x-leg.from.x)*Math.cos(leg.fromYaw)-(leg.to.z-leg.from.z)*Math.sin(leg.fromYaw);
  const crossDirection=localRight*mirror<0?'right':'left';
  // Crossover names identify anatomical feet. Select the leading foot in the
  // mirrored player's frame, while the drill's travel direction stays fixed.
  const requestedClip=leg.clip?.startsWith('cross-')
    ? `cross-${leg.clip.includes('-back-')?'back':'front'}-${crossDirection}` as MotionId : leg.clip;
  const clip:MotionId=requestedClip??(running?'run-forward':walking?'walk-forward':Math.abs(lx)>Math.abs(lz)?lx<0?'move-right':'move-left':lz>0?'move-forward':'move-backward');
  const spec=library.clips[clip] as {duration:number;locomotion?:{cycleDistance?:number;stanceFraction?:number;footLift?:number}};
  const stride=spec.locomotion?.cycleDistance??(running?2.15:walking?.95:.72);
  const phase=covered/stride,blend=ease(elapsed/.22)*ease(remaining/.22);
  const crossWeight=cross?1-ease((elapsed-.55)/.35):0;
  const crossClip=('cross-front-'+crossDirection) as MotionId;
  const crossSpec=library.clips[crossClip] as {duration:number}|undefined;
  const isSpecial=clip.startsWith('slide-')||clip.startsWith('cross-');
  const runWeight=running&&!leg.clip?ease((speed-1.1)/1.7):1;
  const baseLayers:MotionSample['layers']=[
    {clip:'ready',time:0,weight:1-blend},
    {clip,time:isSpecial?progress*spec.duration:(phase%1)*spec.duration,weight:blend*(1-crossWeight)*runWeight},
    ...(runWeight<1?[{clip:'walk-forward' as const,time:(phase%1)*library.clips['walk-forward'].duration,weight:blend*(1-crossWeight)*(1-runWeight)}]:[]),
    ...(cross&&crossSpec&&crossWeight>0?[{clip:crossClip,time:clamp(elapsed/.9)*crossSpec.duration,weight:blend*crossWeight}]:[])];
  const rotated=(p:readonly number[],a:number):Vec3=>{
    const x=p[0]!*library.scale*mirror,z=p[2]!*library.scale;
    return {x:x*Math.cos(a)+z*Math.sin(a),y:p[1]!*library.scale+library.floorOffset,z:-x*Math.sin(a)+z*Math.cos(a)};
  };
  const yawAtDistance=(s:number)=>{
    // Invert the same distance curve to get the foot's facing at touchdown.
    let lo=0,hi=1;for(let i=0;i<18;i++){const m=(lo+hi)/2;if(travelCurve(m).progress<clamp(s/d))lo=m;else hi=m;}
    const t=(lo+hi)/2*duration;
    return travelTurn?yawMix(yawMix(leg.fromYaw,heading,ease((t-turnIn)/turnDuration)),leg.toYaw,ease((turnDuration-duration+t)/turnDuration)):yawMix(leg.fromYaw,leg.toYaw,clamp(s/d));
  };
  const foot=(side:'left'|'right'):Vec3=>{
    const offset=side==='right'?.5:0,cycle=Math.floor(phase-offset),v=phase-offset-cycle;
    const stance=spec.locomotion?.stanceFraction??(running?.36:.62),swing=clamp((v-stance)/(1-stance));
    const lane=running||walking?.13:.26;
    const at=(s:number)=>{const center=point(leg.from,leg.to,clamp(s/d)),local=rotated([side==='left'?lane:-lane,.087,side==='left'?.05:-.025],yawAtDistance(s));return {x:center.x+local.x,y:local.y,z:center.z+local.z};};
    const plant=(cycle+offset+stance/2)*stride,a=at(plant),b=at(plant+stride);
    // Recover the heel early behind the pelvis, then lower it before placement.
    const t=ease(swing),lift=Math.sin(Math.PI*Math.pow(swing,running?.65:1))*(spec.locomotion?.footLift??.065);
    const moving={x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)+(v>stance?lift:0),z:mix(a.z,b.z,t)};
    const local=rotated([side==='left'?.26:-.26,.087,side==='left'?.05:-.025],yaw);
    return {x:mix(root.x+local.x,moving.x,blend),y:mix(local.y,moving.y,blend),z:mix(root.z+local.z,moving.z,blend)};
  };
  const crossingTargets=(endRoot:Vec3,v:number,name:string)=>{
    const leading=name.endsWith('left')?'left':'right';
    const target=(side:'left'|'right'):Vec3=>{
      const offset=rotated([side==='left'?.26:-.26,.087,side==='left'?.05:-.025],leg.fromYaw);
      const a={x:leg.from.x+offset.x,y:offset.y,z:leg.from.z+offset.z},b={x:endRoot.x+offset.x,y:offset.y,z:endRoot.z+offset.z};
      // The trailing foot crosses first; the supporting foot stays anchored,
      // then follows. Passing clearance distinguishes front/back crossovers.
      const swing=side===leading?clamp((v-.48)/.52):clamp(v/.48),w=ease(swing);
      const clearance=rotated([0,0,(name.includes('-back-')?-.24:.24)*Math.sin(Math.PI*swing)],leg.fromYaw);
      const p={x:mix(a.x,b.x,w)+clearance.x,y:offset.y+.08*Math.sin(Math.PI*swing),z:mix(a.z,b.z,w)+clearance.z};
      return {x:mix(root.x+offset.x,p.x,blend),y:mix(offset.y,p.y,blend),z:mix(root.z+offset.z,p.z,blend)};
    };
    return {left:target('left'),right:target('right')};
  };
  let footTargets:MotionSample['footTargets'];
  if(clip.startsWith('cross-'))footTargets=crossingTargets(leg.to,progress,clip);
  else if(!isSpecial){
    footTargets={left:foot('left'),right:foot('right')};
    if(crossWeight>0){
      const crossingSeconds=Math.min(.75,duration*.5),endRoot=point(leg.from,leg.to,travelCurve(crossingSeconds/duration).progress);
      const targets=crossingTargets(endRoot,clamp(elapsed/crossingSeconds),crossClip);
      const interpolate=(a:Vec3,b:Vec3):Vec3=>({x:mix(a.x,b.x,crossWeight),y:mix(a.y,b.y,crossWeight),z:mix(a.z,b.z,crossWeight)});
      footTargets={left:interpolate(footTargets.left,targets.left),right:interpolate(footTargets.right,targets.right)};
    }
  }
  const arrival=leg.arrival,prepareSeconds=arrival?(entrySpec(arrival)?.blendSeconds??.48)/arrival.rate:0;
  const preparedWeight=arrival?ease((prepareSeconds-remaining)/prepareSeconds):0;
  const preparationTime=arrival?Math.max(0,arrival.entryTime!-Math.max(0,remaining)*arrival.rate):0;
  const layers:MotionSample['layers']=arrival?[...baseLayers.map(layer=>({...layer,weight:layer.weight*(1-preparedWeight)})),
    {clip:arrival.clip,time:preparationTime,weight:preparedWeight}]:baseLayers;
  return {root,yaw,hand,event:null,verticalCorrection:arrival?entryCorrection(arrival,preparationTime)*preparedWeight:0,toss:null,layers,
    movement:{stage:leg.stage,speed,acceleration,distance:covered,phase,heading},
    travelLean:travelTurn?Math.max(-.2,Math.min(.2,Math.atan2(acceleration,9.81)*.35+speed/MAX_OPPONENT_SPEED*.055))*blend*(1-crossWeight)*(1-preparedWeight):0,
    lookYaw:travelTurn?Math.max(-1,Math.min(1,Math.atan2(Math.sin(leg.toYaw-yaw),Math.cos(leg.toYaw-yaw))))*blend*(1-preparedWeight):0,
    ...(footTargets?{footTargets,footTargetWeight:1-preparedWeight}:{})};
}

export function sampleRecovery(plan:RecoveryPlan,time:number,hand:'left'|'right'):MotionSample {
  if(time<plan.recover.start)return rest(plan.recover.from,plan.recover.fromYaw,hand,'ready');
  if(time<plan.recover.end)return sampleTravel(plan.recover,time,hand);
  if(plan.kind==='direct')return arrivalRest(plan.recover,hand);
  if(time<plan.splitStart)return rest(plan.center,Math.PI,hand,'ready');
  if(time<plan.splitEnd)return rest(plan.center,Math.PI,hand,'split',(time-plan.splitStart)*SPLIT_SECONDS/(plan.splitEnd-plan.splitStart),true);
  if(plan.approach&&time<plan.approach.end)return sampleTravel(plan.approach,time,hand);
  return plan.approach?arrivalRest(plan.approach,hand):rest(plan.center,Math.PI,hand,'ready');
}

export const MOVEMENT_DRILLS = [
  ['Slow walk','walk-forward',2,1.0],['Walk','walk-forward',3,1.6],['Brisk walk','walk-forward',4,2.2],['Run','run-forward',7,4.8],
  ['Front cross left','cross-front-left',-.85,1.6],['Front cross right','cross-front-right',.85,1.6],
  ['Back cross left','cross-back-left',-.85,1.6],['Back cross right','cross-back-right',.85,1.6],
  ['Nudge left','move-left',-.5,1],['Nudge right','move-right',.5,1],['Nudge forward','move-forward',.5,1],['Nudge backward','move-backward',-.5,1],
  ['Jump','jump',0,1],['Split-step','split-step',0,1],
  ['Slide left','slide-left',-1.6,2],['Slide right','slide-right',1.6,2],['Slide forward','slide-forward',1.6,2],
  ['Slide forward left','slide-forward',1.6,2],['Slide forward right','slide-forward',1.6,2],
] as const;

export function sampleMovementDrill(index:number,time:number,hand:'left'|'right'='right'):MotionSample {
  const [label,name,travel,pace]=MOVEMENT_DRILLS[index]??MOVEMENT_DRILLS[0];
  const clip=name as MotionId,spec=library.clips[clip],base={x:0,y:0,z:13};
  if(travel===0)return {...rest(base,Math.PI,hand,'drill'),layers:[{clip,time:Math.min(spec.duration,Math.max(0,time-.3)),weight:1}]};
  const lateral=name.includes('left')||name.includes('right');
  const diagonal=label==='Slide forward left'?-Math.PI/4:label==='Slide forward right'?Math.PI/4:0;
  const to={x:lateral?travel:Math.sin(diagonal)*travel,y:0,z:13-(lateral?0:Math.cos(diagonal)*travel)};
  const duration=Math.max(spec.duration,travelDuration(base,to,pace));
  return sampleTravel({from:base,to,start:.3,end:.3+duration,fromYaw:Math.PI-diagonal,toYaw:Math.PI-diagonal,stage:'drill',clip},time,hand);
}

