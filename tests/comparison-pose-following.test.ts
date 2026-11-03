import { describe, expect, it } from 'vitest';
import { PoseFollower } from '../src/video-comparison/analysis/poseFollower';
import { repairPose } from '../src/video-comparison/analysis/poseSeries';
import { emptySeries, ESTIMATED, OBSERVED, putSample, sampleAt } from '../src/video-comparison/analysis/types';
import { createFrameIndex } from '../src/video-comparison/timeline';

// A person in source pixels, translated across a 1000x600 video.
function pose(x = 200, y = 300, width = 1000, height = 600) {
  const offsets = [[0,-120],[-10,-125],[10,-125],[-20,-120],[20,-120],[-30,-60],[30,-60],[-50,0],[50,0],[-60,60],[60,60],[-25,40],[25,40],[-25,110],[25,110],[-25,180],[25,180]];
  return new Float32Array(offsets.flatMap(([dx,dy]) => [(x+dx)/width,(y+dy)/height,.9]));
}
describe('pose region follows a selected person', () => {
  it.each([1,-1])('leaves the seed region in time direction %s without clipping limbs', direction => {
    const follower = new PoseFollower(1000,600,{x:.12,y:.2,width:.16,height:.65});
    for(let i=0;i<10;i++) {
      const x=200+i*35, time=1+direction*i/15, points=pose(x);
      expect(follower.score(points,time)).toBeGreaterThan(0);
      follower.accept(points,time);
      const region=follower.regions(time+direction/15)[0];
      expect(region.x).toBeLessThan((x+35)/1000);
      expect(region.x+region.width).toBeGreaterThan((x+95)/1000);
      expect(region.y+region.height).toBeGreaterThan(.79);
    }
    expect(follower.regions(1+direction*10/15)[0].x).toBeGreaterThan(.2);
  });
  it('widens after loss but rejects a distant bystander and implausible scale', () => {
    const follower = new PoseFollower(1000,600,{x:.1,y:.2,width:.2,height:.65});
    expect(follower.score(pose(850),0)).toBe(-1);
    follower.accept(pose(),0);
    const before=follower.regions(.05)[0]; follower.accept(undefined,.05); follower.accept(undefined,.1);
    expect(follower.regions(.15)[0].width).toBeGreaterThan(before.width);
    expect(follower.score(pose(850),.15)).toBe(-1);
    expect(follower.score(pose(235),.15)).toBeGreaterThan(0);
    const giant=pose();for(let p=0;p<17;p++) giant[p*3+1]=.5+(giant[p*3+1]-.5)*3;
    expect(follower.score(giant,.15)).toBe(-1);
  });
  it('requests recovery for edge-clipped limbs or a weak torso, on portrait sources too', () => {
    const follower = new PoseFollower(600,1000,{x:.2,y:.1,width:.6,height:.6}), values=pose(300,350,600,1000);
    follower.accept(values,0);
    const [r]=follower.regions(.03);
    expect(r.width*600).toBeCloseTo(r.height*1000,2);
    expect(follower.sufficient(values,r)).toBe(true);
    values[9*3]=r.x+.001;
    expect(follower.sufficient(values,r)).toBe(false);
    values[5*3+2]=values[6*3+2]=0;
    expect(follower.score(values,.03)).toBeGreaterThan(0);
    values[11*3+2]=values[12*3+2]=0;
    expect(follower.score(values,.03)).toBe(-1);
  });
});

function fixture(times:number[]) {
  const index=createFrameIndex(times.map(timestamp=>({timestamp,duration:.02})));
  const series=emptySeries(0,times.length-1,17,1000,600,'fixture');
  times.forEach((t,f)=>{const points=pose(200+200*t);for(let p=0;p<17;p++) putSample(series,f,p,points[p*3],points[p*3+1],points[p*3+2]);});
  return {index,series};
}
function remove(series:ReturnType<typeof emptySeries>,f:number,p:number) {series.states[f*17+p]=0;}
describe('conservative source-time pose repairs', () => {
  it('never alters any direct measurement, including abrupt or weak detections', () => {
    const {series,index}=fixture([0,.02,.05,.1,.15]);
    putSample(series,2,9,.6,.2,.27);remove(series,1,10);
    const before=series.values.slice(), states=series.states.slice(), repaired=repairPose(series,index);
    expect(series.values).toEqual(before); expect(series.states).toEqual(states);
    for(let i=0;i<states.length;i++)if(states[i]===OBSERVED)expect(repaired.values.slice(i*3,i*3+3)).toEqual(before.slice(i*3,i*3+3));
    expect(sampleAt(repaired,2,9)?.state).toBe(OBSERVED);
  });
  it('fills a brief VFR wrist dropout relative to its moving elbow', () => {
    const {series,index}=fixture([0,.02,.05,.09,.14]);
    remove(series,2,9);remove(series,3,9);
    const repaired=repairPose(series,index);
    for(const f of [2,3]) {const point=sampleAt(repaired,f,9)!;expect(point.state).toBe(ESTIMATED);expect(point.x).toBeCloseTo((140+200*index.timestamps[f])/1000,5);}
  });
  it('extrapolates for at most 80 ms without feeding estimates into later estimates', () => {
    const {series,index}=fixture([0,.04,.08,.12,.16,.20,.24,.28]);
    for(let f=2;f<8;f++)remove(series,f,9);
    const repaired=repairPose(series,index);
    expect(sampleAt(repaired,2,9)?.state).toBe(ESTIMATED);expect(sampleAt(repaired,3,9)?.state).toBe(ESTIMATED);
    expect(sampleAt(repaired,3,9)!.confidence).toBeLessThan(sampleAt(repaired,2,9)!.confidence);
    for(let f=4;f<8;f++)expect(sampleAt(repaired,f,9)).toBeNull();
  });
  it('does not invent a missing player, a large limb jump or a long hidden interval', () => {
    const {series,index}=fixture([0,.04,.08,.12,.16,.20,.24,.28,.32]);
    for(let f=2;f<=7;f++) for(let p=0;p<17;p++)remove(series,f,p);
    const repaired=repairPose(series,index);
    for(let f=2;f<=7;f++)for(let p=0;p<17;p++)expect(sampleAt(repaired,f,p)).toBeNull();
    const short=fixture([0,.04,.08]);remove(short.series,1,9);putSample(short.series,2,9,.9,.1,.9);
    expect(sampleAt(repairPose(short.series,short.index),1,9)).toBeNull();
  });
  it('preserves existing draft estimates and does not extrapolate offscreen', () => {
    const {series,index}=fixture([0,.04,.08]);putSample(series,1,9,.999,.5,.8,ESTIMATED);
    expect(sampleAt(repairPose(series,index),1,9)).toEqual(sampleAt(series,1,9));
    putSample(series,0,9,.98,.5,.9);putSample(series,1,9,.999,.5,.9);remove(series,2,9);
    expect(sampleAt(repairPose(series,index),2,9)).toBeNull();
  });
});

it('marks an angle estimated when its distal limb is inferred, even if its joint center was detected', async () => {
  const {drawMotion}=await import('../src/video-comparison/analysis/draw');
  const {newMotion}=await import('../src/video-comparison/analysis/types');
  const {series,index}=fixture([0]);putSample(series,0,9,.14,.6,.4,ESTIMATED);
  const motion=newMotion();motion.pose.result=series;motion.view.skeleton=false;motion.joints=['leftElbow'];
  const labels:string[]=[];const noop=()=>{};
  const context={save:noop,restore:noop,translate:noop,scale:noop,strokeText:noop,fillText:(text:string)=>labels.push(text)} as unknown as CanvasRenderingContext2D;
  drawMotion(context,motion,index,0,{x:0,y:0,width:1000,height:600});
  expect(labels).toHaveLength(1);expect(labels[0]).toMatch(/^≈/);
});
