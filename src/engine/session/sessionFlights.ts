import type { CompiledSession } from './compileSession';
import type { ResolvedTrajectory } from '../trajectory/physics';

export type SessionFlight = Readonly<{trajectory:ResolvedTrajectory;time:number;phase:'outgoing'|'return';index:number}>;
export function sessionFlights(session:CompiledSession,time:number):SessionFlight[] {
  const flights:SessionFlight[]=[];
  for(const rep of session.repetitions){
    const age=time-rep.startTime,rally=rep.rallyReturn;
    if(age<0)continue;
    if(rally&&age>=rally.contactTime){
      if(age<rally.contactTime+rally.duration-1e-8)flights.unshift({trajectory:rally.trajectory,time:age-rally.contactTime,phase:'return',index:rep.index});
    }else if(age<=(rally?.contactTime??rep.trajectory.samples.at(-1)!.time)){
      if(session.mode==='drill'&&time>=(session.repetitions[rep.index+1]?.startTime??Infinity))continue;
      flights.unshift({trajectory:rep.trajectory,time:age,phase:'outgoing',index:rep.index});
    }
  }
  return flights;
}
