import { useEffect, useRef } from 'react';
import { cameraMovementForKeys, type CameraMoveKey } from '../domain/court';
import { SHOT_CAMERA_RANGES } from '../engine/session/cameraTimeline';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';

/** Preview at frame rate; a complete key gesture produces one undoable edit. */
export function useEditorCameraMovement(camera: CameraConfiguration, enabled: boolean,
  onPreview: (camera: CameraConfiguration) => void, onCommit: (camera: CameraConfiguration) => void) {
  const current = useRef(camera), callbacks = useRef({ onPreview, onCommit });
  current.current = camera; callbacks.current = { onPreview, onCommit };
  useEffect(() => {
    if (!enabled) return;
    const held = new Set<string>();
    let frame = 0, last = 0, fast = false, changed = false;
    const stop = () => {
      held.clear(); if (frame) cancelAnimationFrame(frame); frame = 0;
      if (changed) { changed = false; callbacks.current.onCommit(current.current); }
    };
    const editing = (target: EventTarget | null) => target instanceof HTMLElement
      && !!target.closest('input, textarea, select, [contenteditable="true"], dialog, [role="dialog"]');
    const move = (distance: number) => {
      const pose = current.current;
      const delta = cameraMovementForKeys(held as Set<CameraMoveKey>, distance, pose.yaw);
      const height = (held.has('pageup') ? 1 : 0) - (held.has('pagedown') ? 1 : 0);
      const clamp = (value: number, key: 'lateral' | 'behindBaseline' | 'eyeHeight') =>
        Math.max(SHOT_CAMERA_RANGES[key][0], Math.min(SHOT_CAMERA_RANGES[key][1], value));
      const next = { ...pose, lateral: clamp(pose.lateral + delta.lateral, 'lateral'),
        behindBaseline: clamp(pose.behindBaseline + delta.behindBaseline, 'behindBaseline'),
        eyeHeight: clamp(pose.eyeHeight + height * distance, 'eyeHeight') };
      current.current = next; changed = true; callbacks.current.onPreview(next);
    };
    const tick = (time: number) => {
      move(Math.min(.05, (time - last) / 1000) * (fast ? 6 : 2.4)); last = time;
      frame = requestAnimationFrame(tick);
    };
    const down = (event: KeyboardEvent) => {
      if (editing(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Shift') fast = true;
      const key = event.key.toLowerCase();
      if (!['w', 'a', 's', 'd', 'pageup', 'pagedown'].includes(key)) return;
      event.preventDefault(); fast = event.shiftKey;
      if (!held.has(key)) { held.add(key); move(fast ? .1 : .04); }
      if (!frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === 'Shift') fast = false;
      held.delete(event.key.toLowerCase()); if (!held.size) stop();
    };
    const focus = (event: FocusEvent) => { if (editing(event.target)) stop(); };
    const visibility = () => { if (document.hidden) stop(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('blur', stop); document.addEventListener('focusin', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('blur', stop); document.removeEventListener('focusin', focus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled]);
}
