/** Equal-RMS comparison renders; all browser inputs are application/RAM bytes. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {build} from 'rolldown';
const {chromium}=await import(process.env.AUDIO_PLAYWRIGHT_MODULE || 'playwright');
await mkdir('tmp/contact-review',{recursive:true});
const old=spawnSync('git',['show','ceb24ac:public/assets/audio/contact-1.b7e5343be65d.wav'],{maxBuffer:1024*1024});assert.equal(old.status,0);
const legacy=spawnSync('git',['show','ceb24ac:src/engine/audio/synthesis.ts'],{encoding:'utf8'});assert.equal(legacy.status,0);
await writeFile('tmp/contact-review/legacy-synthesis.ts',legacy.stdout);
await writeFile('tmp/contact-review/entry.ts',`export { AudioPalette } from '../../src/engine/audio/AudioPalette';
export { SoundscapeGraph } from '../../src/engine/audio/SoundscapeGraph';
export { ContactSelector } from '../../src/engine/audio/contactSelection';
export { contactPcm } from '../../src/engine/audio/synthesis';
export { contactPcm as oldContactPcm } from './legacy-synthesis';`);
const bundle=await build({input:'tmp/contact-review/entry.ts',output:{format:'iife',name:'ContactQA'}});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({offline:true});const requests=[];context.on('request',r=>requests.push(r.url()));
 await context.route('**/*',r=>r.request().url()==='https://audio.test/'?r.fulfill({contentType:'text/html',body:'Contact comparison'}):r.abort());
 const page=await context.newPage();await page.goto('https://audio.test/');await page.addScriptTag({content:bundle.output[0].code});
 const result=await page.evaluate(async oldBase64=>{
  const {AudioPalette,SoundscapeGraph,ContactSelector,contactPcm,oldContactPcm}=ContactQA;
  const reports=[];
  for(const venue of ['dry','hard-open-arena','timber-hall'])for(const version of ['old-recording','new-recordings','old-fallback','new-fallback']){
   const context=new OfflineAudioContext(2,48000*11,48000),graph=new SoundscapeGraph(context),palette=new AudioPalette(context),selector=new ContactSelector();
   graph.output.connect(context.destination);if(venue!=='dry')graph.setVenue(venue);
   const old=await context.decodeAudioData(Uint8Array.from(atob(oldBase64),c=>c.charCodeAt(0)).buffer);
   if(version==='new-recordings')for(let i=0;i<12;i++)await palette.load(`contact-${i}`);
   const selections=[];
   for(let i=0;i<12;i++){
    const cue={id:`review:${i}`,time:.2+i*.7,kind:'contact',family:i<4?'groundstroke':i<8?'serve':'groundstroke',spin:i>=8?'slice':'flat',speedKmh:[55,90,140,190][i%4]};
    const selected=selector.select(cue,912);selections.push(selected.index);
    let buffer;
    if(version==='old-recording')buffer=old;
    else if(version==='new-recordings')buffer=palette.contact(selected.index);
    else {const pcm=(version==='old-fallback'?oldContactPcm:contactPcm)(48000,157+i%4);buffer=context.createBuffer(1,pcm.length,48000);buffer.copyToChannel(pcm,0);}
    const modern=version.startsWith('new');
    graph.play(buffer,'contact',{when:cue.time,gain:.35*(modern?selected.gain:Math.max(.45,Math.min(1,cue.speedKmh/140))),rate:modern?selected.rate:1,cutoff:modern?selected.cutoff:undefined,decay:modern?selected.decay:undefined});
   }
   const audio=await context.startRendering(),channels=[audio.getChannelData(0),audio.getChannelData(1)];let sum=0,peak=0;
   for(const c of channels)for(const x of c){sum+=x*x;peak=Math.max(peak,Math.abs(x));}
   const rms=Math.sqrt(sum/(audio.length*2)),gain=Math.min(.9/peak,.005/rms);
   const bytes=new Uint8Array(audio.length*4),view=new DataView(bytes.buffer);
   for(let i=0;i<audio.length;i++)for(let c=0;c<2;c++)view.setInt16(i*4+c*2,Math.round(channels[c][i]*gain*32767),true);
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   reports.push({venue,version,pcm:btoa(binary),rms:rms*gain,peak:peak*gain,selections,decodedBytes:palette.decodedBytes});
   graph.dispose();palette.clear();
  }return reports;
 },old.stdout.toString('base64'));
 assert.deepEqual(requests,['https://audio.test/']);
 for(const item of result){assert(item.peak<1);assert(Math.abs(item.rms-.005)<1e-6);const pcm=Buffer.from(item.pcm,'base64'),h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+pcm.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(48000,24);h.writeUInt32LE(192000,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);await writeFile(`tmp/contact-review/${item.venue}-${item.version}.wav`,Buffer.concat([h,pcm]));delete item.pcm;}
 await writeFile('tmp/contact-review/comparison.json',JSON.stringify({method:'Real Web Audio renders. Equal RMS, not a claim of equal perceived loudness. Same 12 events at 55/90/140/190 km/h. Old recordings/fallback from ceb24ac. No browser media HTTP.',requests,result},null,2));console.log('12 dry/outdoor/indoor comparison renders passed; equal RMS and no clipping.');
}finally{await browser.close();}
