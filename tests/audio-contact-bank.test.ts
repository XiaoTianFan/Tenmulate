import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ContactSelector } from '../src/engine/audio/contactSelection';
import { AudioPalette } from '../src/engine/audio/AudioPalette';
import bank from '../src/content/contact-bank.json';
import manifest from '../src/content/audio-palette.json';

it('ships twelve distinct recorded takes with exact embedded WAV bytes', () => {
 const ids = Object.keys(bank) as (keyof typeof bank)[];
 expect(ids).toHaveLength(12);
 expect(new Set(ids.map(id => manifest.assets[id].sha256)).size).toBe(12);
 for (const id of ids) {
  expect(Buffer.from(bank[id], 'base64')).toEqual(readFileSync(`public${manifest.assets[id].url}`));
  expect(manifest.assets[id].recipe.independentTake).toBe(true);
 }
 expect(new Set(ids.map(id => `${manifest.assets[id].source}:${manifest.assets[id].recipe.startSample}`)).size).toBe(12);
});

it('decodes contact recordings without fetching any media URL and coalesces loads', async () => {
 const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Media HTTP forbidden'));
 try {
  const buffer = { length: 11520, numberOfChannels: 1 } as AudioBuffer;
  const decode = vi.fn(async () => buffer);
  const palette = new AudioPalette({ decodeAudioData: decode } as unknown as BaseAudioContext);
  const first = palette.load('contact-0'); expect(palette.load('contact-0')).toBe(first);
  expect(await first).toBe(buffer); expect(palette.contactSource(0)).toBe('contact-0');
  expect(palette.contact(0)).toBe(buffer); expect(palette.contact(3)).toBe(buffer);
  expect(fetch).not.toHaveBeenCalled(); expect(decode).toHaveBeenCalledTimes(1);
  palette.clear(); expect(palette.contactSource(0)).toBe('procedural');
 } finally { fetch.mockRestore(); }
});

it('uses stroke families, avoids the last two takes, and reproduces selection after reset', () => {
 const selector = new ContactSelector();
 const run = (family: string, spin = 'flat') => Array.from({length: 20}, (_, i) => selector.select({ id: `shot:${i}`, time: i, kind: 'contact', family, spin }, 71));
 for (const [family, spin, start] of [['groundstroke','flat',0], ['serve','flat',4], ['groundstroke','slice',8], ['volley','flat',8]] as const) {
  selector.reset(); const result=run(family,spin);
  result.forEach((value,i)=>{expect(value.index).toBeGreaterThanOrEqual(start);expect(value.index).toBeLessThan(start+4);
   expect(result.slice(Math.max(0,i-2),i).map(v=>v.index)).not.toContain(value.index);});
  selector.reset(); expect(run(family,spin)).toEqual(result);
 }
});

it('changes spectral brightness and decay with intensity while keeping pitch close to the recording', () => {
 const selector=new ContactSelector();
 const cue={id:'shot',kind:'contact' as const,time:0};
 const soft=selector.select({...cue,speedKmh:40},1), hard=selector.select({...cue,speedKmh:190},1);
 expect(soft.gain).toBeLessThan(hard.gain);expect(soft.cutoff).toBeLessThan(hard.cutoff);expect(soft.decay).toBeLessThan(hard.decay);
 for(const value of [soft,hard])expect(Math.abs(value.rate-1)).toBeLessThanOrEqual(.005);
});
