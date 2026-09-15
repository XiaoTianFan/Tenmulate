import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import motion from '../src/content/opponent-motion.json';
import carrier from '../src/content/opponent-asset.json';

it('excludes authoring sources without excluding runtime assets from CLI uploads', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const ignoreFile = fileURLToPath(new URL('../.vercelignore', import.meta.url));
  const required = [
    `public${motion.url}`, `public${carrier.url}`,
    'public/assets/opponents/tennis-local-v1.manifest.json',
    'public/assets/venues/hard-open-arena/manifest.json',
    'public/assets/audience/spectators-front-512.webp',
    'scripts/check-motion-integration.mjs',
  ];
  const excluded = ['assets/venues/example.blend', 'tmp/example.txt', '.vercel/project.json'];
  // .vercelignore uses gitignore-style anchored directory patterns. Exercise
  // those patterns against the actual deployment paths, including tracked files.
  const result = spawnSync('git', ['-c', `core.excludesFile=${ignoreFile}`, 'check-ignore', '--no-index', '--stdin'], {
    cwd: root, input: [...required, ...excluded].join('\n'), encoding: 'utf8',
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.trim().split(/\r?\n/)).toEqual(excluded);
});
