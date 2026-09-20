/** Contact-only asset authoring. Node fetch never opens a browser/media handler. */
import {readFile,writeFile,mkdir,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const temp=resolve(root,'tmp/contact-upgrade'),output=resolve(root,'public/assets/audio');
const sha=x=>createHash('sha256').update(x).digest('hex');
const recordings=[
 {id:662263,sha256:'d154e00fee6b2fa7c49c9e4a0b8625b0571f9710072cafbf4eeb5ea1fdf56d9b',group:'drive',title:'Tennis Forehand 2',peaks:[.13,.685,1.345,1.985]},
 {id:662265,sha256:'fbc7f32bcb125927005085b72f846b92753b67fda47f760cfd22bcacdb918aad',group:'serve',title:'Tennis Serves 1',peaks:[.14,.91,1.68,2.605]},
 {id:662270,sha256:'a86b35b016fca65407833a10e254cdaa3611b2ad3cdcfd73e454d4cb8fdad542',group:'slice',title:'Tennis Slices 1',peaks:[.18,1.97,2.715,3.8]},
];
function ffmpeg(args){const r=spawnSync('ffmpeg',['-v','error',...args],{maxBuffer:8*1024*1024});if(r.status!==0)throw Error(String(r.stderr));return r.stdout;}
function wav(x){const b=Buffer.alloc(44+x.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(96000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(x.length*2,40);x.forEach((v,i)=>b.writeInt16LE(Math.round(v*32767),44+i*2));return b;}
export async function buildContactBank(){
 await mkdir(temp,{recursive:true});
 const manifest=JSON.parse(await readFile(resolve(root,'src/content/audio-palette.json'),'utf8'));
 const provenance=JSON.parse(await readFile(resolve(output,'provenance.json'),'utf8'));
 for(const id of Object.keys(manifest.assets))if(id.startsWith('contact-'))delete manifest.assets[id];
 const embedded={};let index=0;
 for(const rec of recordings){
  const url=`https://cdn.freesound.org/previews/662/${rec.id}_4980667-hq.mp3`,path=resolve(temp,`${rec.id}.mp3`);
  let raw;try{raw=await readFile(path);}catch{const r=await fetch(url);if(!r.ok)throw Error(`Source ${rec.id}: ${r.status}`);raw=Buffer.from(await r.arrayBuffer());await writeFile(path,raw);}
  if(sha(raw)!==rec.sha256)throw Error('Source hash changed; re-verify before authoring');
  const source=`jamesdrake89-${rec.id}`;
  const previous=provenance.sources.find(s=>s.id===source);if(previous&&previous.sha256!==sha(raw))throw Error('Source changed; re-verify provenance');
  if(!previous)provenance.sources.push({id:source,title:rec.title,author:'jamesdrake89',page:`https://freesound.org/people/jamesdrake89/sounds/${rec.id}/`,url,sha256:sha(raw),license:'CC0-1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',retrieved:'2026-09-20',note:'Public HQ MP3 preview of mono 48 kHz recording; lossy, not the login-gated WAV original. Author discloses wind/traffic. Four separate transients extracted.'});
  const pcm=ffmpeg(['-i',path,'-ar','48000','-ac','1','-af','highpass=f=70,lowpass=f=11000','-f','f32le','-']);
  const samples=Array.from({length:pcm.length/4},(_,i)=>pcm.readFloatLE(i*4));
  for(const peakTime of rec.peaks){
   const lo=Math.max(0,Math.floor((peakTime-.06)*48000)),hi=Math.floor((peakTime+.03)*48000);
   let peak=0;for(let i=lo;i<hi;i++)peak=Math.max(peak,Math.abs(samples[i]));
   let onset=lo;while(onset<hi&&Math.abs(samples[onset])<peak*.06)onset++;
   const start=Math.max(0,onset-36),length=11520,x=samples.slice(start,start+length);
   const gain=.72/Math.max(...x.map(Math.abs));
   for(let i=0;i<x.length;i++)x[i]*=gain*Math.min(1,i/24)*Math.min(1,(x.length-1-i)/2880);
   const bytes=wav(x),hash=sha(bytes),id=`contact-${index++}`,name=`${id}.${hash.slice(0,12)}.wav`;
   await writeFile(resolve(output,name),bytes);embedded[id]=bytes.toString('base64');
   manifest.assets[id]={url:`/assets/audio/${name}`,sha256:hash,bytes:bytes.length,source,group:rec.group,channels:1,sampleRate:48000,recipe:{startSample:start,durationSamples:length,sourcePeakSeconds:peakTime,filter:'70 Hz high-pass, 11 kHz low-pass',gain,fadeInSamples:24,fadeOutSamples:2880,independentTake:true}};
  }
 }
 const keep=new Set(Object.values(manifest.assets).map(a=>a.url.split('/').at(-1)));
 // Only retired generated contact files in this exact delivery directory.
 for(const name of await readdir(output))if(/^contact-\d+\.[a-f0-9]{12}\.wav$/.test(name)&&!keep.has(name))await unlink(resolve(output,name));
 const shipped=Object.values(manifest.assets).reduce((n,a)=>n+a.bytes,0)+Buffer.byteLength(JSON.stringify(embedded));
 if(shipped>6*1024*1024)throw Error('Complete audio transfer budget exceeded');
 provenance.assets=manifest.assets;provenance.generated='scripts/audio/build-palette.mjs + scripts/audio/build-contact-bank.mjs';
 await writeFile(resolve(root,'src/content/audio-palette.json'),JSON.stringify(manifest,null,2)+'\n');
 await writeFile(resolve(root,'src/content/contact-bank.json'),JSON.stringify(embedded)+'\n');
 await writeFile(resolve(output,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');
 await writeFile(resolve(output,'NOTICE.txt'),'Tenmulate audio palette\nContacts: jamesdrake89, Tennis Forehand 2 / Tennis Serves 1 / Tennis Slices 1.\nCrowd: qubodup (Well Done), jayfrosting (Murmur 1.wav).\nRecorded sources are CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/\nSee provenance.json for source links, hashes, transformations and lossy preview limitations.\nBounces and environmental layers are authored synthesis.\n');
 console.log('Published',index,'independent contacts; embedded WAV bank bytes',JSON.stringify(embedded).length);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildContactBank();

