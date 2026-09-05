import { TennisScene, type CameraConfiguration, type QualityMode } from './engine/rendering/TennisScene';
import { DEFAULT_ENVIRONMENT, SCENE_DEFINITIONS, normalizeAudienceOccupancy, normalizeVenueId, type EnvironmentConfiguration } from './domain/environment';
import { registerPwa } from './app/registerPwa';

const canvas = document.querySelector('canvas')!;
const status = document.querySelector('#status')!;
const parameters = new URLSearchParams(location.search);
function rememberReviewChoice(key: string, value: string): void {
  const url = new URL(location.href);
  url.searchParams.set(key, value);
  history.replaceState(null, '', url);
}
registerPwa();
const initialQuality: QualityMode = parameters.get('quality') === 'performance' ? 'performance' : parameters.get('quality') === 'auto' ? 'auto' : 'quality';
const initialVenue = normalizeVenueId(parameters.get('venue'));
let environment: EnvironmentConfiguration = { ...DEFAULT_ENVIRONMENT, venue: initialVenue, lighting: SCENE_DEFINITIONS[initialVenue].defaultLighting, audience: normalizeAudienceOccupancy(parameters.get('audience')) };
const scene = new TennisScene(canvas, metrics => {
  status.textContent = `${canvas.dataset.venueSource === 'blender' ? 'Blender · ' + canvas.dataset.venueVariant : metrics.venueAsset.status === 'error' ? 'Venue unavailable: ' + metrics.venueAsset.message : 'Loading venue…'} · ${metrics.drawCalls} draws · ${(metrics.triangles / 1000).toFixed(0)}k triangles · ${metrics.fps} fps · ${metrics.audience.count.toLocaleString()} spectators${metrics.audience.status === 'loading' ? ' (loading)' : metrics.audience.status === 'error' ? ' · ' + metrics.audience.message : ''}`;
  canvas.dataset.audience = metrics.audience.status;
  canvas.dataset.spectators = String(metrics.audience.count);
  document.querySelector<HTMLButtonElement>('#retry')!.hidden = metrics.venueAsset.status !== 'error' && metrics.audience.status !== 'error';
  canvas.dataset.drawCalls = String(metrics.drawCalls);
  canvas.dataset.triangles = String(metrics.triangles);
  canvas.dataset.textures = String(metrics.textures);
}, { quality: initialQuality, environment });
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
let cameraPreset = views[initialCamera] ? initialCamera : 'player';
function cameraView(name: string): CameraConfiguration {
  const indoor = SCENE_DEFINITIONS[environment.venue].setting === 'indoor';
  if (indoor && name === 'sideline') return { ...views.sideline!, eyeHeight: 3.8, lateral: 11.5, pitch: 6, fov: 105 };
  if (indoor && name === 'corner') return { ...views.corner!, eyeHeight: 4.2, lateral: 11.2, behindBaseline: 7, pitch: 1 };
  return { ...(views[name] ?? views.player!) };
}
let view: CameraConfiguration = cameraView(cameraPreset);
scene.setCamera(view);
scene.setVenueReview(parameters.get('camera') !== 'overview');
document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button => {
  button.setAttribute('aria-pressed', String(button.dataset.camera === (views[initialCamera] ? initialCamera : 'player')));
  button.addEventListener('click', () => {
    cameraPreset = button.dataset.camera!;
    rememberReviewChoice('camera', cameraPreset);
    view = cameraView(cameraPreset);
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
  const name = environment.venue === 'grass-center-court' ? 'Grass Open Arena' : environment.venue === 'clay-sunset-arena' ? 'Clay Open Arena' : environment.venue === 'hard-open-arena' ? 'Hard Open Arena' : SCENE_DEFINITIONS[environment.venue].label;
  document.title = `${name} — Tenmulate review`;
  document.querySelector('h1')!.textContent = `${name} / venue study`;
  canvas.setAttribute('aria-label', `${name} scene review`);
}
venue.value = environment.venue;
updateReviewIdentity();
venue.addEventListener('change', () => {
  environment = { ...environment, venue: normalizeVenueId(venue.value), lighting: SCENE_DEFINITIONS[normalizeVenueId(venue.value)].defaultLighting };
  rememberReviewChoice('venue', environment.venue);
  scene.setSurface(SCENE_DEFINITIONS[environment.venue].defaultSurface);
  scene.setEnvironment(environment);
  updateReviewIdentity();
  view = cameraView(cameraPreset);
  scene.setCamera(view);
});
document.querySelector<HTMLSelectElement>('[aria-label="Render quality"]')!.value = initialQuality;
document.querySelector<HTMLSelectElement>('[aria-label="Render quality"]')!.addEventListener('change', event => {
  const quality = (event.target as HTMLSelectElement).value as QualityMode;
  rememberReviewChoice('quality', quality);
  scene.setQualityMode(quality);
});
const occupancy = document.querySelector<HTMLSelectElement>('[aria-label="Audience"]')!;
occupancy.value = environment.audience;
occupancy.addEventListener('change', () => {
  environment = { ...environment, audience: normalizeAudienceOccupancy(occupancy.value) };
  rememberReviewChoice('audience', environment.audience);
  scene.setEnvironment(environment);
});
document.querySelector('#retry')!.addEventListener('click', () => scene.retryVenue());
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
