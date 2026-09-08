// Optional developer harness. Uses an installed Playwright module (or its file
// URL in PLAYWRIGHT_MODULE) and Edge, without changing the user's browser profile.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').catch(() => {
  throw new Error('Install Playwright in your tooling environment and set PLAYWRIGHT_MODULE to its index.mjs file URL.');
});
const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ configFile: false, root,
  cacheDir: 'node_modules/.cache/renderer-benchmark',
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: { alias: [
    { find: /^three$/, replacement: `${root}/node_modules/three/build/three.module.js` },
    { find: 'three/addons', replacement: `${root}/node_modules/three/examples/jsm` },
    { find: 'three/examples/jsm', replacement: `${root}/node_modules/three/examples/jsm` },
  ] },
  server: { host: '127.0.0.1', port: 4187, strictPort: true } });
let browser;
const errors = [];
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true,
    args: process.argv.includes('--rtx') ? ['--force_high_performance_gpu'] : [] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, serviceWorkers: 'block' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/renderer-benchmark', route => route.fulfill({ contentType: 'text/html', body:
    '<style>body{margin:0}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas>' }));
  await page.goto('http://127.0.0.1:4187/renderer-benchmark');
  const fixture = await page.evaluate(async () => {
    const [{ TennisScene }, { DEFAULT_ENVIRONMENT }, { DRILLS }, { compilePracticePreview }] = await Promise.all([
      import('/src/engine/rendering/TennisScene.ts'), import('/src/domain/environment.ts'),
      import('/src/content/bundled.ts'), import('/src/engine/session/practicePreview.ts'),
    ]);
    const settings = { repetitions: 12, shotIntervalSeconds: 5, rhythmPercent: 100, movementPercent: 100,
      trajectoryMode: 'natural', mode: 'quick-practice', practiceShotType: 'groundstroke', practiceStroke: 'alternate',
      variationPercent: 8, timingVariationPercent: 0, launchSpeedKmh: 70, spin: 'topspin', spinRateRpm: 1103,
      surface: 'hard', seed: '18427', opponentHand: 'right', workBlockSize: 50, restSeconds: 0, serveRhythm: 'normal',
      opponentPosition: { x: 0, z: 12.885 }, landingDepthM: 8.5, aimDirectionDeg: 0, landingZone: { width: 1.6, depth: 2 } };
    const session = compilePracticePreview(DRILLS[0], settings), clock = { current: 3 };
    const scene = new TennisScene(document.querySelector('canvas'), undefined,
      { quality: 'quality', environment: DEFAULT_ENVIRONMENT, profile: true });
    scene.setSession(session, clock); scene.setTrajectory(session.repetitions[0].trajectory);
    scene.setTrajectoryVisible(true); scene.setBallFocus({ enabled: true });
    window.benchmark = { scene, clock };
    return { settings, environment: DEFAULT_ENVIRONMENT, userAgent: navigator.userAgent };
  });
  await page.waitForFunction(() => {
    const { scene } = window.benchmark;
    return scene.activeAuthoredArena.state.status === 'ready' && scene.audience.state.status === 'ready'
      && document.querySelector('canvas').dataset.opponentAsset === 'ready';
  }, null, { timeout: 60000 });
  await page.evaluate(() => window.benchmark.scene.setActive(false));
  const rows = [];
  const timeline = process.argv.includes('--timeline');
  const sizes = timeline ? [[600, 400]] : [[600, 400], [1280, 800], [1920, 1080], [2560, 1600]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    // Re-enable only the old zero-light/sky-order costs for the controlled A/B.
    // All assets, samples, shadows, audience and effects are otherwise identical.
    for (const mode of timeline ? ['current'] : ['previous-render-order', 'current']) {
      const result = await page.evaluate(async ({ mode, timeline }) => {
        const { scene, clock } = window.benchmark;
        scene.setActive(false);
        scene.skySystem.sky.renderOrder = mode === 'current' ? 10000 : 0;
        scene.scene.traverse(object => {
          if (object.isPointLight || object.isSpotLight) object.visible = mode !== 'current' || object.intensity > 0;
        });
        // Test harness only: setActive(false) parks the animation loop, then we
        // explicitly size and tick the actual production scene at its source clock.
        scene.renderer.setPixelRatio(1.5);
        scene.renderer.setSize(innerWidth, innerHeight, false);
        scene.camera.aspect = innerWidth / innerHeight; scene.camera.updateProjectionMatrix();
        const tick = async time => {
          const now = await new Promise(requestAnimationFrame);
          clock.current = time; scene.animate(now);
        };
        for (let i = 0; i < 60; i++) await tick(3);
        scene.resetRendererProfile();
        for (let i = 0; i < (timeline ? 3600 : 240); i++) await tick(3 + i / (timeline ? 30 : 120));
        return { ...scene.getRendererProfile(), glError: scene.renderer.getContext().getError() };
      }, { mode, timeline });
      rows.push({ mode, ...result });
      console.log(JSON.stringify(rows.at(-1)));
    }
  }
  const report = { fixture, rows, errors, note: 'Headless GPU/CPU cost; RAF cadence is not foreground FPS acceptance.' };
  const outputIndex = process.argv.indexOf('--out');
  if (outputIndex >= 0) await writeFile(process.argv[outputIndex + 1], JSON.stringify(report, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  await page.evaluate(() => window.benchmark.scene.dispose());
} finally {
  await browser?.close(); await server.close();
}
