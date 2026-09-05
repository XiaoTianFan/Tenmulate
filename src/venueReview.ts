import { TennisScene, type CameraConfiguration, type QualityMode } from './engine/rendering/TennisScene';
import { DEFAULT_ENVIRONMENT, SCENE_DEFINITIONS, normalizeVenueId, type EnvironmentConfiguration } from './domain/environment';
import { registerPwa } from './app/registerPwa';
import { isAuthoredVenue } from './engine/rendering/VenueAssetManager';

const canvas = document.querySelector('canvas')!;
const status = document.querySelector('#status')!;
const parameters = new URLSearchParams(location.search);
registerPwa();
const authored = parameters.get('version') !== 'procedural';
let environment: EnvironmentConfiguration = { ...DEFAULT_ENVIRONMENT, venue: normalizeVenueId(parameters.get('venue')) };
const scene = new TennisScene(canvas, metrics => {
  status.textContent = `${canvas.dataset.venueSource === 'blender' ? 'Blender arena' : metrics.venueAsset.status === 'error' ? 'Fallback: ' + metrics.venueAsset.message : authored && isAuthoredVenue(environment.venue) ? 'Loading arena…' : 'Procedural fallback'} · ${metrics.drawCalls} draws · ${(metrics.triangles / 1000).toFixed(0)}k triangles · ${metrics.fps} fps`;
  canvas.dataset.drawCalls = String(metrics.drawCalls);
  canvas.dataset.triangles = String(metrics.triangles);
  canvas.dataset.textures = String(metrics.textures);
}, { authoredArena: authored });
scene.setQualityMode('quality');
scene.setSurface(SCENE_DEFINITIONS[environment.venue].defaultSurface);
scene.setEnvironment(environment);
const views: Record<string, CameraConfiguration> = {
  player: { eyeHeight: 1.7, behindBaseline: 2.1, lateral: 0, yaw: 0, pitch: 4, fov: 85 },
  corner: { eyeHeight: 7, behindBaseline: 10, lateral: 16, yaw: -35, pitch: -5, fov: 87 },
  sideline: { eyeHeight: 8.2, behindBaseline: -11.885, lateral: 19, yaw: -90, pitch: 5, fov: 103 },
  overview: { eyeHeight: 62, behindBaseline: 55, lateral: 56, yaw: -40, pitch: -37, fov: 82 },
  roof: { eyeHeight: 72, behindBaseline: 63, lateral: 56, yaw: -37, pitch: -40, fov: 82 },
};
const initialCamera = parameters.get('camera') ?? 'player';
let view: CameraConfiguration = { ...(views[initialCamera] ?? views.player!) };
scene.setCamera(view);
scene.setVenueReview(parameters.get('camera') !== 'overview');
document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button => {
  button.setAttribute('aria-pressed', String(button.dataset.camera === (views[initialCamera] ? initialCamera : 'player')));
  button.addEventListener('click', () => {
    view = { ...views[button.dataset.camera!]! };
    scene.setCamera(view);
    scene.setVenueReview(button.dataset.camera !== 'overview');
    document.querySelectorAll('[data-camera]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  });
});
document.querySelector<HTMLSelectElement>('[aria-label="Time of day"]')!.addEventListener('change', event => {
  const timeOfDay = Number((event.target as HTMLSelectElement).value);
  environment = { ...environment, timeOfDay, lighting: timeOfDay > 20 ? 'night' : timeOfDay > 17 ? 'golden-hour' : 'day' };
  scene.setEnvironment(environment);
});
const venue = document.querySelector<HTMLSelectElement>('[aria-label="Venue"]')!;
function updateReviewIdentity() {
  const name = environment.venue === 'clay-sunset-arena' ? 'Clay Open Arena' : environment.venue === 'hard-open-arena' ? 'Hard Open Arena' : SCENE_DEFINITIONS[environment.venue].label;
  document.title = `${name} — Tenmulate review`;
  document.querySelector('h1')!.textContent = `${name} / venue study`;
  canvas.setAttribute('aria-label', `${name} scene review`);
}
venue.value = environment.venue;
updateReviewIdentity();
venue.addEventListener('change', () => {
  environment = { ...environment, venue: normalizeVenueId(venue.value) };
  scene.setSurface(SCENE_DEFINITIONS[environment.venue].defaultSurface);
  scene.setEnvironment(environment);
  updateReviewIdentity();
});
const version = document.querySelector<HTMLSelectElement>('[aria-label="Venue version"]')!;
document.querySelector<HTMLSelectElement>('[aria-label="Render quality"]')!.addEventListener('change', event => {
  scene.setQualityMode((event.target as HTMLSelectElement).value as QualityMode);
});
version.value = authored ? 'blender' : 'procedural';
version.addEventListener('change', () => { location.search = `?version=${version.value}&venue=${environment.venue}`; });
let pointer: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', e => { pointer = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { pointer = null; });
canvas.addEventListener('pointercancel', () => { pointer = null; });
canvas.addEventListener('pointermove', e => {
  if (!pointer) return;
  view = { ...view, yaw: view.yaw - (e.clientX - pointer.x) * .16, pitch: Math.max(-89, Math.min(89, view.pitch - (e.clientY - pointer.y) * .16)) };
  pointer = { x: e.clientX, y: e.clientY };
  scene.setCamera(view);
});
canvas.addEventListener('wheel', e => { e.preventDefault(); view = { ...view, fov: Math.max(25, Math.min(115, view.fov + e.deltaY * .035)) }; scene.setCamera(view); }, { passive: false });
window.addEventListener('pagehide', () => scene.dispose(), { once: true });
if (import.meta.hot) import.meta.hot.dispose(() => scene.dispose());
