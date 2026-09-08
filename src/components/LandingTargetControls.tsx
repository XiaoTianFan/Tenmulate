import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { MoveHorizontal, MoveVertical } from 'lucide-react';
import type { TennisScene } from '../engine/rendering/TennisScene';
import type { ResolvedTrajectory } from '../engine/trajectory/physics';

type Point = Readonly<{x:number;z:number}>;
type Axis = 'direction' | 'depth';

/** A screen-space manipulator anchored to the actual first bounce. */
export function LandingTargetControls({sceneRef,trajectory,target=trajectory.intent.target,onChange}:Readonly<{
  sceneRef:RefObject<TennisScene|null>;trajectory:ResolvedTrajectory;
  target?:Point;onChange:(target:Point)=>void;
}>){
  const [position,setPosition]=useState<{x:number;y:number}|null>(null);
  const [expanded,setExpanded]=useState(false);
  const [active,setActive]=useState<Axis|null>(null);
  const drag=useRef<{id:number;axis:Axis;pointer:Point;target:Point;screenX:number;screenY:number;moved:boolean}|null>(null);
  useEffect(()=>{
    let frame=0,last=0;
    const tick=(time:number)=>{
      if(time-last>60){
        last=time;
        const bounce=trajectory.events.find(e=>e.type==='bounce');
        const next=bounce?sceneRef.current?.projectCourtPoint(bounce.position)??null:null;
        setPosition(old=>old&&next&&Math.hypot(old.x-next.x,old.y-next.y)<.5?old:next);
      }
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[sceneRef,trajectory]);
  const start=(event:PointerEvent<HTMLButtonElement>,axis:Axis)=>{
    if(event.button!==0)return;
    const point=sceneRef.current?.courtPointFromClientPoint(event.clientX,event.clientY);
    if(!point)return;
    event.preventDefault();event.stopPropagation();
    drag.current={id:event.pointerId,axis,pointer:point,target,screenX:event.clientX,screenY:event.clientY,moved:false};
    event.currentTarget.setPointerCapture(event.pointerId);setActive(axis);setExpanded(true);
  };
  const move=(event:PointerEvent<HTMLButtonElement>)=>{
    const current=drag.current;if(!current||current.id!==event.pointerId)return;
    if(Math.hypot(event.clientX-current.screenX,event.clientY-current.screenY)<3&&!current.moved)return;
    current.moved=true;
    const point=sceneRef.current?.courtPointFromClientPoint(event.clientX,event.clientY);if(!point)return;
    onChange(current.axis==='direction'
      ? {x:current.target.x+point.x-current.pointer.x,z:current.target.z}
      : {x:current.target.x,z:current.target.z+point.z-current.pointer.z});
  };
  const finish=(event:PointerEvent<HTMLButtonElement>)=>{
    if(drag.current?.id!==event.pointerId)return;
    const current=drag.current;
    if(!current.moved && event.type==='pointerup'){
      const bounds=event.currentTarget.getBoundingClientRect();
      const delta=current.axis==='direction'?(event.clientX<bounds.x+bounds.width/2?.2:-.2):(event.clientY<bounds.y+bounds.height/2?-.2:.2);
      onChange(current.axis==='direction'?{...current.target,x:current.target.x+delta}:{...current.target,z:current.target.z+delta});
    }
    drag.current=null;setActive(null);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  if(!position)return null;
  return <div className={`landing-controls${expanded?' expanded':''}${active?' dragging':''}`}
    data-target-x={target.x} data-target-z={target.z} style={{left:position.x,top:position.y}} onPointerEnter={()=>setExpanded(true)}
    onPointerLeave={()=>{if(!drag.current)setExpanded(false);}} onFocus={()=>setExpanded(true)}
    onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setExpanded(false);}}>
    <button type="button" className="landing-center" aria-label="Edit first bounce landing point"
      onClick={()=>setExpanded(value=>!value)}><span /></button>
    {(['direction','depth'] as const).map(axis=><button key={axis} type="button"
      className={`landing-axis ${axis}${active===axis?' active':''}`} aria-label={`Adjust landing ${axis}`}
      title={axis==='direction'?'Drag left/right to aim':'Drag up/down to change depth'}
      onPointerDown={event=>start(event,axis)} onPointerMove={move} onPointerUp={finish}
      onPointerCancel={finish} onLostPointerCapture={()=>{drag.current=null;setActive(null);}}
      onKeyDown={event=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
        event.preventDefault();const delta=(event.key==='ArrowLeft'||event.key==='ArrowDown'?1:-1)*.2;
        onChange(axis==='direction'?{...target,x:target.x+delta}:{...target,z:target.z+delta});
      }}>{axis==='direction'?<MoveHorizontal size={40}/>:<MoveVertical size={40}/>}</button>)}
    <span className="landing-controls-label">{active==='depth'?'Landing depth':active==='direction'?'Shot direction':'Drag arrows to aim'}</span>
  </div>;
}
