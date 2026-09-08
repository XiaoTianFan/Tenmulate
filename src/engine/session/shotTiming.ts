import { minimumMotionGap, withPreparedApproach, type MotionRepetition } from './opponentTimeline';
import { RHYTHM_RANGE } from './rhythm';

/** Bounded two-parameter search. Pace controls are preferences; contact interval
 * wins whenever a combination within the motion/travel limits can satisfy it.
 * Raising an already scheduled stroke's rate only shrinks its occupied window. */
export function solveShotInterval<T extends MotionRepetition>(previous:T,next:T,requestedGap:number,
  additionalGap:(previous:T,next:T)=>number=()=>0) {
  const ceiling=RHYTHM_RANGE.max/100;
  const base=[previous.motionRate??1,next.motionRate??1,previous.movementRate??1,next.movementRate??1];
  const evaluate=(stroke:number,movement:number)=>{
    const rates=base.map((value,i)=>value+(ceiling-value)*(i<2?stroke:movement));
    const a={...previous,motionRate:rates[0]!,movementRate:rates[2]!};
    const b=withPreparedApproach(a,{...next,startTime:a.startTime+requestedGap,motionRate:rates[1]!,movementRate:rates[3]!});
    const required=Math.max(minimumMotionGap(a,b),additionalGap(a,b));
    const cost=rates.reduce((sum,value,i)=>sum+(i<2?1:.35)*Math.log(value/base[i]!)**2,0);
    return {previous:a,next:b,gap:Math.max(requestedGap,required),required,cost};
  };
  const preferred=evaluate(0,0);
  if(preferred.required<=requestedGap+1e-8)return {...preferred,gap:requestedGap,limited:false};
  let best:ReturnType<typeof evaluate>|null=null;
  // 51 movement levels, each with a monotone bisection for the smallest stroke
  // adjustment. No ball physics or rig sampling occurs inside this search.
  for(let step=0;step<=50;step++) {
    const movement=step/50,fast=evaluate(1,movement);
    if(fast.required>requestedGap+1e-8)continue;
    let lo=0,hi=1;
    if(evaluate(0,movement).required<=requestedGap)hi=0;
    else for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(evaluate(mid,movement).required>requestedGap)lo=mid;else hi=mid;}
    const candidate=evaluate(hi,movement);
    if(!best||candidate.cost<best.cost)best=candidate;
  }
  if(best)return {...best,gap:requestedGap,limited:false};
  const fastest=evaluate(1,1);
  return {...fastest,limited:true};
}
