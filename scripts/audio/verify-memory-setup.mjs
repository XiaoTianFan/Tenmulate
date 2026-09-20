import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { openMemoryApp } from './memory-app.mjs';
const { chromium } = await import(process.env.AUDIO_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const app = await openMemoryApp(browser);
try {
 const page = await app.context.newPage(); page.setDefaultTimeout(45000);
 const errors=[]; page.on('pageerror', e=>errors.push(e.message));
 await page.goto(app.url);
 await page.getByRole('button',{name:'Start practice',exact:true}).waitFor();
 await page.evaluate(async()=>{globalThis.audioUnderTest=(await import('/src/engine/audio/AudioCueEngine.ts')).practiceAudio;});
 await page.getByRole('button',{name:'Tap to enable sound',exact:true}).click();
 await page.waitForFunction(()=>audioUnderTest.metrics.dispatches.some(x=>x.id.startsWith('bounce')));
 const quick=await page.evaluate(()=>audioUnderTest.metrics);
 await mkdir('tmp/audio-review',{recursive:true});
 await page.screenshot({path:'tmp/audio-review/quick-setup-audio.png'});
 assert(quick.dispatches.some(x=>x.id.startsWith('contact')));
 await page.getByRole('slider',{name:'Contact volume',exact:true}).fill('0.3');
 // Observe actual post-master audio, with transport entirely in RAM.
 await page.evaluate(async()=>{
  const lease=await audioUnderTest.capture(); const ctx=new AudioContext(); await ctx.resume();
  const analyser=ctx.createAnalyser(); const source=ctx.createMediaStreamSource(lease.stream); const silent=ctx.createGain(); silent.gain.value=0;
  source.connect(analyser).connect(silent).connect(ctx.destination); globalThis.monitor={lease,ctx,analyser};
 });
 const rms=()=>page.evaluate(()=>{const a=new Float32Array(monitor.analyser.fftSize);monitor.analyser.getFloatTimeDomainData(a);return Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length);});
 await page.waitForTimeout(500); const audible=await rms(); assert(audible>1e-8);
 await page.getByRole('button',{name:'Mute all sound',exact:true}).click(); await page.waitForTimeout(150); assert(await rms()<1e-6);
 await page.getByRole('button',{name:'Unmute all sound',exact:true}).click();
 await page.getByRole('button',{name:'Start practice',exact:true}).click();
 const safe=page.getByRole('checkbox',{name:'I have cleared a safe practice area.'});
 if(await safe.count()){await safe.check();await page.getByRole('button',{name:'Continue',exact:true}).click();}
 await page.getByRole('button',{name:'Pause',exact:true}).waitFor(); await page.keyboard.press('h');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 assert.equal(await page.getByRole('slider',{name:'Contact volume',exact:true}).inputValue(),'0.3');
 await page.getByRole('button',{name:'Close settings',exact:true}).click();
 await page.getByRole('button',{name:'Exit',exact:true}).click();
 await page.getByRole('button',{name:'Drills',exact:true}).click();
 assert.equal(await page.getByRole('slider',{name:'Contact volume',exact:true}).inputValue(),'0.3');
 await page.getByRole('slider',{name:'Bounce volume',exact:true}).fill('0.2');
 console.log('Quick preview, actual capture/mute, and setup -> rehearsal -> library mix passed');
 await page.getByRole('button',{name:'Edit drill',exact:true}).click();
 await page.waitForFunction(()=>audioUnderTest.metrics.dispatches.some(x=>x.id.startsWith('bounce')));
 const editor=await page.evaluate(()=>audioUnderTest.metrics);
 await page.screenshot({path:'tmp/audio-review/editor-setup-audio.png'});
 assert.equal(await page.getByRole('slider',{name:'Bounce volume',exact:true}).inputValue(),'0.2');
 await page.waitForTimeout(12000); const looped=await page.evaluate(()=>audioUnderTest.metrics.dispatches.length); assert(looped>editor.dispatches.length);
 await page.getByRole('button',{name:'Drills',exact:true}).click();
 await page.getByRole('button',{name:'Run drill',exact:true}).click();
 await page.getByRole('button',{name:'Pause',exact:true}).waitFor(); await page.keyboard.press('h');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 assert.equal(await page.getByRole('slider',{name:'Bounce volume',exact:true}).inputValue(),'0.2');
 assert.deepEqual(errors,[]); assert.deepEqual(app.mediaRequests,[]);
 await mkdir('tmp/audio-review',{recursive:true}); await page.screenshot({path:'tmp/audio-review/setup-audio.png'});
 await writeFile('tmp/audio-setup-result.json',JSON.stringify({passed:true,quick,editor,looped,audible,errors,mediaRequests:app.mediaRequests},null,2));
 console.log('Editor loops and drill launch levels passed; zero browser media HTTP requests.');
} finally {await app.close();await browser.close();}
