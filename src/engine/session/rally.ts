import { COURT } from '../../domain/court';
import type { ShotDefinitionV1 } from '../../content/types';
import type { Vec3 } from '../../domain/vector';
import { integrateTrajectory, netHeightAt, type ResolvedTrajectory, type ShotIntent } from '../trajectory/physics';
import { reachableContacts, playerAt, type PlayerPath } from './playerCoverage';

export type RallyReturn = Readonly<{ trajectory: ResolvedTrajectory; contactTime: number;
  duration: number; contactErrorM: number; speedRatio: number }>;
const norm = (v: Vec3) => Math.hypot(v.x,v.y,v.z);
const minus = (a: Vec3,b: Vec3): Vec3 => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});

/** Solve launch velocity at a fixed arrival time using the actual 240 Hz solver.
 * No curve-warping, endpoint snapping or time-stretching of an existing flight. */
function solveReturn(intent: ShotIntent, target: Vec3, duration: number, bounced: boolean): ResolvedTrajectory | null {
  const d = minus(target,intent.source);
  let velocity: Vec3 = { x:d.x/duration*1.5,z:d.z/duration*1.5,
    y:bounced ? Math.max(2, duration*4.4) : (d.y+4.905*duration*duration)/duration };
  const simulate = (v: Vec3) => integrateTrajectory(intent,v,duration);
  let flight = simulate(velocity);
  for(let iteration=0;iteration<24;iteration++) {
    const end=flight.samples.at(-1)!.position, error=minus(target,end);
    if(norm(error)<.012) return flight;
    // Finite differences include aerodynamic loss and bounce friction. A wider
    // derivative step avoids unstable derivatives at discrete ground contacts.
    const h=norm(error)<.2?.06:.3, axes=['x','y','z'] as const;
    const columns=axes.map(axis => {
      const p=simulate({...velocity,[axis]:velocity[axis]+h}).samples.at(-1)!.position;
      return {x:(p.x-end.x)/h,y:(p.y-end.y)/h,z:(p.z-end.z)/h};
    });
    const matrix=axes.map(axis=>[...columns.map(c=>c[axis]),error[axis]]);
    let singular=false;
    for(let c=0;c<3;c++) {
      let pivot=c;for(let r=c+1;r<3;r++)if(Math.abs(matrix[r]![c]!)>Math.abs(matrix[pivot]![c]!))pivot=r;
      [matrix[c],matrix[pivot]]=[matrix[pivot]!,matrix[c]!];
      const scale=matrix[c]![c]!;
      if(Math.abs(scale)<1e-6){singular=true;break;}
      for(let k=c;k<4;k++)matrix[c]![k]!/=scale;
      for(let r=0;r<3;r++)if(r!==c){const factor=matrix[r]![c]!;for(let k=c;k<4;k++)matrix[r]![k]!-=factor*matrix[c]![k]!;}
    }
    if(singular)break;
    let improved=false;
    for(const damping of [1,.5,.2]) {
      const candidate={...velocity};axes.forEach((axis,i)=>{candidate[axis]+=Math.max(-8,Math.min(8,matrix[i]![3]!))*damping;});
      const next=simulate(candidate);
      if(norm(minus(target,next.samples.at(-1)!.position))<norm(error)){velocity=candidate;flight=next;improved=true;break;}
    }
    if(!improved)break;
  }
  return norm(minus(target,flight.samples.at(-1)!.position))<.025?flight:null;
}

/** Every accepted return starts on the incoming flight and arrives at the next
 * racket's exact scheduled contact (within the numerical solver tolerance). */
export function planRallyReturn(incoming: ResolvedTrajectory, next: ShotDefinitionV1, player: PlayerPath,
  minimumGap: number, preferredGap: number): RallyReturn | null {
  if(next.family==='serve')return null;
  const contacts=reachableContacts(incoming,player);
  if(!contacts.length)return null;
  const target=next.source, mustBounce=!['volley','overhead'].includes(next.family);
  const preferred=incoming.resolved.launchSpeedKmh;
  // Bounded candidate set keeps compilation deterministic and interactive.
  const distance=(s:typeof contacts[number])=>Math.hypot(s.position.x-playerAt(player,s.time).x,s.position.z-playerAt(player,s.time).z);
  const ranked=[...contacts].sort((a,b)=>distance(a)-distance(b));
  const candidates=[ranked[0]!,contacts[0]!,contacts[Math.floor(contacts.length/2)]!,contacts.at(-1)!];
  let best:RallyReturn|null=null,bestScore=Infinity;
  for(const contact of candidates) {
    const travel=Math.hypot(target.x-contact.position.x,target.z-contact.position.z)/(preferred/3.6)*1.5;
    const minimum=Math.max(.45,minimumGap-contact.time);
    const desired=Math.max(minimum,preferredGap-contact.time);
    const durations=[desired,Math.max(minimum,travel),minimum,Math.max(minimum,travel*1.3)];
    for(const duration of [...new Set(durations.map(t=>Math.ceil(t*240)/240))]) {
      if(duration>4.8||contact.time+duration<minimumGap-1e-7)continue;
      const intent:ShotIntent={source:contact.position,target:{x:target.x,z:target.z},launchSpeedKmh:preferred,
        spin:mustBounce?'topspin':'flat',spinRateRpm:mustBounce?900:0,family:mustBounce?'groundstroke':'volley',
        surface:incoming.intent.surface,windVelocity:incoming.intent.windVelocity,receiverZ:target.z};
      const flight=solveReturn(intent,target,duration,mustBounce);
      if(!flight||Math.abs(flight.samples.at(-1)!.time-duration)>1e-8)continue;
      const ratio=flight.resolved.launchSpeedKmh/preferred;
      const net=flight.events.find(e=>e.type==='net-crossing'),bounce=flight.events.find(e=>e.type==='bounce');
      const maximumApex=next.family==='overhead'?10:next.family==='volley'?4.5:6;
      if(ratio<.65||ratio>1.35||!net||net.position.y<netHeightAt(net.position.x)+COURT.ballRadius+.05
        ||flight.apexHeight>maximumApex
        ||flight.events.some(e=>e.type==='second-bounce')||!!bounce!==mustBounce)continue;
      if(bounce&&(bounce.time<=net.time||bounce.position.z>COURT.halfLength||bounce.position.z<=0||Math.abs(bounce.position.x)>COURT.singlesWidth/2))continue;
      const score=Math.abs(contact.time+duration-preferredGap)+Math.abs(1-ratio)*.7;
      if(score<bestScore){bestScore=score;best={trajectory:{...flight,intent:{...flight.intent,target:bounce?{x:bounce.position.x,z:bounce.position.z}:{x:target.x,z:target.z}}},
        contactTime:contact.time,duration,contactErrorM:norm(minus(target,flight.samples.at(-1)!.position)),speedRatio:ratio};}
      if(bestScore<.05)return best;
    }
  }
  return best;
}
