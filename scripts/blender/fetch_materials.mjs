import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../../assets/venues/hard-open-arena/', import.meta.url);
const sources = JSON.parse(await readFile(new URL('sources.json', root), 'utf8'));
await mkdir(new URL('textures/', root), { recursive: true });
for (const material of sources.materials) for (const file of material.files) {
  const target = new URL(`textures/${file.name}`, root);
  const existing = await readFile(target).catch(() => null);
  if (existing && createHash('md5').update(existing).digest('hex') === file.md5) continue;
  const response = await fetch(`https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${material.id}/${file.name}`, {
    headers: { 'User-Agent': 'TenmulateVenueBuild/1.0 (local development)' },
  });
  if (!response.ok) throw new Error(`Texture request failed: ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (createHash('md5').update(data).digest('hex') !== file.md5) throw new Error(`Checksum mismatch: ${file.name}`);
  await writeFile(target, data);
  console.log(`Verified ${file.name}: ${data.length} bytes`);
}
