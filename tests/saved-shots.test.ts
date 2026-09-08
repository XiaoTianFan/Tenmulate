import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRILLS, SHOT_BY_ID, drillShotPace } from '../src/content/bundled';
import { copyShotEvent, eventCamera, snapshotShot } from '../src/content/editing';
import { isSavedShot, parseDrillJson } from '../src/content/validation';
import { DEFAULT_DRILL_CAMERA } from '../src/engine/session/cameraTimeline';
import { DEFAULT_APP_DATA, loadAppData, saveAppData } from '../src/storage/appStorage';
import { compileSession } from '../src/engine/session/compileSession';

afterEach(()=>vi.unstubAllGlobals());
describe('reusable configured shots',()=>{
  const drill={...DRILLS[0]!,defaultInterval:4,defaultRhythmPercent:120,defaultMovementPercent:85};
  const event={id:'first',shotId:'body-neutral',opponentPosition:{x:2,z:12},target:{x:-1,z:-8},landingZone:{width:2,depth:1.4},camera:{...DEFAULT_DRILL_CAMERA,lateral:2,yaw:-8}};
  it('captures inherited settings and makes independent copies when assembling another drill',()=>{
    const saved=snapshotShot(event,drill,event.camera),copy=copyShotEvent(saved),second=copyShotEvent(saved);
    expect(copy.id).not.toBe(saved.id);expect(copy.id).not.toBe(second.id);
    expect(copy.opponentPosition).not.toBe(saved.opponentPosition);expect(copy.camera).not.toBe(saved.camera);
    expect(copy).toMatchObject({rhythmPercent:120,movementPercent:85,intervalSeconds:4,cameraMotion:null,trajectoryMode:'natural',bounceFactor:1,variationPercent:8,stroke:'forehand'});
    expect(copy.paceKmh).toBe(drillShotPace(SHOT_BY_ID.get(event.shotId)!));
    const different={...drill,defaultRhythmPercent:50,defaultMovementPercent:150,defaultInterval:20,events:[copy,second],shotIds:[copy.shotId,second.shotId]};
    const roundTrip=parseDrillJson(JSON.stringify(different));
    expect(roundTrip.events![0]).toEqual(copy);
    const session=compileSession(roundTrip,{repetitions:2,mode:'drill',variationPercent:0,timingVariationPercent:0,launchSpeedKmh:78,surface:'hard',seed:'saved',spin:'preset',opponentHand:'left',workBlockSize:50,restSeconds:0,serveRhythm:'preset'});
    expect(session.repetitions[0]).toMatchObject({camera:event.camera,motionRate:1.2,movementRate:.85,intervalSeconds:4,shot:{opponentHand:'right',stroke:'forehand'}});
    const updated={...saved,camera:{...saved.camera!,yaw:20},opponentPosition:{x:-4,z:13}};
    expect(updated.camera).not.toEqual(copy.camera);expect(copy.opponentPosition).toEqual(event.opponentPosition);
  });
  it('carries unscripted views but honors an explicit shot view and legacy destinations',()=>{
    expect(eventCamera({id:'x',shotId:'fh-cross-deep',cameraMotion:null},event.camera)).toEqual(event.camera);
    expect(eventCamera(event,DEFAULT_DRILL_CAMERA)).toEqual(event.camera);
    expect(eventCamera({id:'x',shotId:'fh-cross-deep'},event.camera)).toMatchObject({lateral:-1.25,yaw:2.5});
  });
  it('persists snapshots, loads older storage, and discards malformed saved shots independently',()=>{
    let stored='';vi.stubGlobal('localStorage',{getItem:()=>stored,setItem:(_key:string,value:string)=>{stored=value;}});
    const saved={id:'shot-local',name:'Wide forehand',event:snapshotShot(event,drill,event.camera)};
    saveAppData({...DEFAULT_APP_DATA,savedShots:[saved]});
    expect(loadAppData().savedShots).toEqual([saved]);
    stored=JSON.stringify({...DEFAULT_APP_DATA,savedShots:undefined});expect(loadAppData().savedShots).toEqual([]);
    stored=JSON.stringify({...DEFAULT_APP_DATA,savedShots:[saved,{...saved,id:'bad id'},{...saved,event:{...saved.event,camera:{yaw:0}}}]});
    expect(loadAppData().savedShots).toEqual([saved]);
    expect(isSavedShot({...saved,event:{...saved.event,spinRateRpm:Infinity}})).toBe(false);
    expect(isSavedShot({...saved,event:{...saved.event,cue:'https://example.com'}})).toBe(false);
  });
});
