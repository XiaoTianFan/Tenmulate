// Mechanical delivery resizing only; artwork and chroma-key edits are imagegen-authored.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
await mkdir('public/assets/audience', { recursive: true });
for (const view of ['front','back']) for (const size of [1024,512]) {
  await sharp(`assets/audience/spectators-${view}.png`).resize(size,size)
    .webp({ quality: 88, smartSubsample: true }).toFile(`public/assets/audience/spectators-${view}-${size}.webp`);
}
