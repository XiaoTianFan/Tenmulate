import { describe, expect, it } from 'vitest';
import { createFrameIndex } from '../src/video-comparison/timeline';
import { emptySeries, putSample, sampleAt, ESTIMATED, newMotion, JOINTS } from '../src/video-comparison/analysis/types';
import { jointAngle, jointSignal } from '../src/video-comparison/analysis/poseAngles';
import { stabilizePose } from '../src/video-comparison/analysis/stabilizePose';
import { plotData } from '../src/video-comparison/analysis/series';
import { plotContactPosition } from '../src/video-comparison/analysis/plotTimeline';

function fixture(times: number[], angle: (t: number, f: number) => number) {
  const index = createFrameIndex(times.map(timestamp => ({ timestamp, duration: .01 })));
  const series = emptySeries(0, times.length - 1, 17, 1000, 1000, 'fixture');
  times.forEach((time, f) => {
    const radians = angle(time, f) * Math.PI / 180;
    for (const [p,x,y] of [[5,.4,.5],[6,.6,.5],[7,.5,.5],[9,.5-.1*Math.cos(radians),.5+.1*Math.sin(radians)],[11,.45,.75],[12,.55,.75]]) putSample(series, f, p, x, y, .95);
  });
  return { series, index, frames: times.map((_, f) => f) };
}
const rms = (values: number[]) => Math.sqrt(values.reduce((sum,v)=>sum+v*v,0)/values.length);
const sequence = (fps:number, duration=2) => Array.from({length:Math.round(fps*duration)+1},(_,i)=>i/fps);
describe('joint curves and coherent angular derivatives', () => {
  it('suppresses high-frequency angle noise and its amplified derivatives without lagging the motion', () => {
    const times=sequence(60), truth=(t:number)=>100+20*Math.sin(2*Math.PI*t);
    const {series,index}=fixture(times,t=>truth(t)+3*Math.sin(2*Math.PI*17*t));
    const filtered=jointSignal(series,index,'leftElbow'), raw=jointSignal(series,index,'leftElbow',0);
    const interior=times.map((t,i)=>({t,i})).filter(({t})=>t>.2&&t<1.8);
    const angleError=rms(interior.map(({t,i})=>filtered.values[i]-truth(t)));
    const velocityError=rms(interior.map(({t,i})=>filtered.velocity[i]-40*Math.PI*Math.cos(2*Math.PI*t)));
    const rawVelocityError=rms(interior.map(({t,i})=>raw.velocity[i]-40*Math.PI*Math.cos(2*Math.PI*t)));
    const accelError=rms(interior.map(({t,i})=>filtered.acceleration[i]+80*Math.PI**2*Math.sin(2*Math.PI*t)));
    const rawAccelError=rms(interior.map(({t,i})=>raw.acceleration[i]+80*Math.PI**2*Math.sin(2*Math.PI*t)));
    expect(angleError).toBeLessThan(.7);expect(velocityError).toBeLessThan(rawVelocityError*.1);expect(accelError).toBeLessThan(rawAccelError*.1);
    expect(filtered.velocity[60]).toBeGreaterThan(110);
  });
  it('keeps genuine repeated turns and fast sustained joint movement', () => {
    const times=sequence(120), {series,index}=fixture(times,t=>100+50*Math.sin(4*Math.PI*t));
    const signal=jointSignal(series,index,'leftElbow');
    for(const t of [.125,.625,1.125,1.625]) expect(signal.values[Math.round(t*120)]).toBeGreaterThan(145);
    for(const t of [.375,.875,1.375]) expect(signal.values[Math.round(t*120)]).toBeLessThan(55);
    expect(signal.velocity[60]).toBeGreaterThan(550);
  });
  it('uses source seconds consistently across frame rates and irregular timestamps', () => {
    const compare=(times:number[])=>{const {series,index}=fixture(times,t=>60+40*t);return jointSignal(series,index,'leftElbow');};
    for(const fps of [15,30,60,120]) {const times=sequence(fps), signal=compare(times), middle=fps;expect(signal.values[middle]).toBeCloseTo(100,3);expect(signal.velocity[middle]).toBeCloseTo(40,2);expect(signal.acceleration[middle]).toBeCloseTo(0,1);}
    const times=sequence(60).map((t,i)=>t+(i%2?.003:0)), signal=compare(times);
    expect(signal.velocity[60]).toBeCloseTo(40,2);expect(signal.acceleration[60]).toBeCloseTo(0,1);
  });
  it('does not bridge long occlusions or derive an angle from a collapsed limb', () => {
    const {series,index}=fixture(sequence(30),()=>90);
    for(let f=10;f<25;f++)series.states[f*17+9]=0;
    const signal=jointSignal(series,index,'leftElbow');
    for(let f=10;f<25;f++){expect(Number.isNaN(signal.values[f])).toBe(true);expect(signal.states[f]).toBe(0);}
    putSample(series,0,9,.5001,.5001,.9);expect(jointAngle(series,0,'leftElbow')).toBeNull();
  });
});
describe('pose stabilization and uncertainty', () => {
  it('repairs a brief out-and-back landmark failure, retains raw evidence, and shares the angle curve with plots', () => {
    const {series,index,frames}=fixture(sequence(60),(_t,f)=>90+(f===40?60:0));
    const before=series.values.slice(), result=stabilizePose(series,index,frames);
    expect(series.values).toEqual(before);expect(result.observations!.values).toEqual(before);
    expect(sampleAt(result,40,9)?.state).toBe(ESTIMATED);
    const stable=jointSignal(result,index,'leftElbow'), raw=jointSignal(result,index,'leftElbow',0);
    expect(stable.values[40]).toBeCloseTo(90,1);expect(raw.values[40]).toBeCloseTo(150,2);
    const motion=newMotion();motion.pose.result=result;
    const plot={id:'plot',target:'joint:leftElbow',metric:'angularVelocity' as const,smoothing:.1};
    expect(plotData(motion,plot,index).values[40]).toBe(stable.velocity[40]);expect(plotData(motion,plot,index).estimated[40]).toBe(true);
  });
  it('fills a 200 ms wrist loss with visible body support, and bounds edge extrapolation to 120 ms', () => {
    const {series,index,frames}=fixture(sequence(60),()=>90);
    for(let f=30;f<40;f++)series.states[f*17+9]=0;
    for(let f=100;f<=120;f++)series.states[f*17+9]=0;
    const result=stabilizePose(series,index,frames), signal=jointSignal(result,index,'leftElbow');
    for(let f=30;f<40;f++) {expect(sampleAt(result,f,9)?.state).toBe(ESTIMATED);expect(signal.values[f]).toBeCloseTo(90,1);}
    expect(sampleAt(result,106,9)?.state).toBe(ESTIMATED);expect(sampleAt(result,107,9)).toBeNull();expect(sampleAt(result,120,9)).toBeNull();
  });
  it('keeps stable draft curves between observations and leaves a fully missing body absent', () => {
    const {series,index}=fixture(sequence(60),t=>80+30*t), frames=Array.from({length:31},(_,i)=>i*4);
    for(let f=0;f<=120;f++)if(f%4)for(let p=0;p<17;p++)series.states[f*17+p]=0;
    const result=stabilizePose(series,index,frames), signal=jointSignal(result,index,'leftElbow');
    expect(signal.velocity[60]).toBeCloseTo(30,0);expect(Math.abs(signal.acceleration[60])).toBeLessThan(5);
    expect(jointSignal(result,index,'leftElbow',0).values[61]).toBeGreaterThan(100);
    const blank=emptySeries(0,120,17,1000,1000,'blank'), missing=stabilizePose(blank,index,frames);
    expect(missing.states.some(Boolean)).toBe(false);
  });
});
it('defaults to all joint angles and full trajectory, with source-time contact markers including frame zero', () => {
  expect(newMotion().joints).toEqual(Object.keys(JOINTS));expect(newMotion().trail).toBe(0);
  const index=createFrameIndex([0,.01,.04,.1,.2].map(timestamp=>({timestamp,duration:.01})));
  expect(plotContactPosition(index,0,0,4)).toBe(0);expect(plotContactPosition(index,3,0,4)).toBe(.5);expect(plotContactPosition(index,4,0,4)).toBe(1);
  expect(plotContactPosition(index,1,2,4)).toBeNull();expect(plotContactPosition(index,null,0,4)).toBeNull();expect(plotContactPosition(index,2,2,2)).toBe(0);
});

it('marks raw angular derivatives influenced by draft estimates without relabeling the observed angle itself', () => {
  const {series,index}=fixture([0,.02,.04],()=>90);
  const wrist=sampleAt(series,1,9)!;putSample(series,1,9,wrist.x,wrist.y,wrist.confidence,ESTIMATED);
  const motion=newMotion();motion.pose.result=series;
  const plot={id:'plot',target:'joint:leftElbow',metric:'angle' as const,smoothing:0};
  expect(plotData(motion,plot,index).estimated[0]).toBe(false);
  expect(plotData(motion,{...plot,metric:'angularVelocity'},index).estimated[0]).toBe(true);
});

it('keeps trimmed pose arrays aligned to original source frame numbers', () => {
  const {series:full,index}=fixture(sequence(60),t=>60+40*t);
  const excerpt=emptySeries(30,90,17,1000,1000,'trimmed');
  excerpt.values.set(full.values.subarray(30*17*3,91*17*3));excerpt.states.set(full.states.subarray(30*17,91*17));
  const result=stabilizePose(excerpt,index,Array.from({length:61},(_,i)=>30+i));
  const signal=jointSignal(result,index,'leftElbow');expect(signal.values[30]).toBeCloseTo(100,3);expect(signal.velocity[30]).toBeCloseTo(40,2);
  const motion=newMotion();motion.pose.result=result;
  const data=plotData(motion,{id:'p',target:'joint:leftElbow',metric:'angle',smoothing:.1},index);
  expect(data.start).toBe(30);expect(data.values[60-data.start]).toBe(signal.values[30]);
});
