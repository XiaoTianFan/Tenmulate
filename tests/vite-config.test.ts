import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('loads the project server config without native warnings or gameplay restart dependencies', () => {
  // Use Vite's real config loader outside Vitest's module transforms.
  const loaded = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { loadConfigFromFile } from 'vite';
    delete process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING;
    const result = await loadConfigFromFile({ command: 'serve', mode: 'development' });
    if (!result) throw new Error('Missing project config');
    console.log(JSON.stringify(result.dependencies));
  `], { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 15_000 });
  expect(loaded.error).toBeUndefined();
  expect(loaded.status, loaded.stderr).toBe(0);
  expect(loaded.stderr).not.toMatch(/unsupported|without a file extension|configLoader/);
  const dependencies: string[] = JSON.parse(loaded.stdout);
  const paths = dependencies.map(path => path.replaceAll('\\', '/'));
  expect(paths.some(path => path.endsWith('/src/content/playerValidation.ts'))).toBe(true);
  expect(paths.some(path => path.includes('/src/engine/'))).toBe(false);
}, 20_000);
