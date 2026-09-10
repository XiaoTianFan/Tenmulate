import { useCallback, useEffect, useRef, useState } from 'react';
import bundledCatalog from '../content/project-shots.json';
import type { SavedShotV2 } from '../content/types';
import { PROJECT_SHOTS_ENDPOINT, validateProjectShots, type ProjectShotsSnapshot } from '../storage/projectShots';

const packaged = validateProjectShots(bundledCatalog);
export function useProjectShots() {
  const [snapshot, setSnapshot] = useState<ProjectShotsSnapshot>({ ...packaged, revision: '' });
  const [status, setStatus] = useState('Connecting to project…'), [writable, setWritable] = useState(false);
  const current = useRef(snapshot), request = useRef(0);
  const accept = useCallback((value: ProjectShotsSnapshot) => {
    validateProjectShots(value);
    if (typeof value.revision !== 'string' || !value.revision) throw new Error('Project server response is invalid.');
    current.current = value; setSnapshot(value); setWritable(true); setStatus('Shots save to the project.');
  }, []);
  const refresh = useCallback(async () => {
    const token = ++request.current;
    try {
      const response = await fetch(PROJECT_SHOTS_ENDPOINT, { cache: 'no-store' });
      if (!response.ok) throw new Error('Project unavailable');
      const value = await response.json();
      if (token === request.current) accept(value);
    } catch {
      if (token === request.current) { setWritable(false); setStatus('Project saving unavailable. Open the local project server to save shots.'); }
    }
  }, [accept]);
  useEffect(() => { void refresh(); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, [refresh]);
  const mutate = async (method: 'PUT' | 'DELETE', data: { shot: SavedShotV2; targetId?: string } | { id: string }) => {
    if (!current.current.revision) throw new Error('Project saving is unavailable. Your shot settings are retained.');
    ++request.current;
    const response = await fetch(PROJECT_SHOTS_ENDPOINT, { method, headers: { 'Content-Type': 'application/json', 'X-Tenmulate-Project': '1' },
      body: JSON.stringify({ ...data, revision: current.current.revision }) });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      if (response.status === 409) await refresh();
      throw new Error(error?.error ?? 'Project save failed. Your shot settings are retained.');
    }
    const value = await response.json() as ProjectShotsSnapshot & { savedId?: string };
    accept(value); return value;
  };
  return { shots: snapshot.shots, writable, status, refresh,
    save: async (shot: SavedShotV2, targetId?: string) => {
      const saved = await mutate('PUT', { shot, targetId });
      const result = saved.shots.find(item => item.id === saved.savedId);
      if (!result) throw new Error('Project did not acknowledge the saved shot.');
      return result;
    },
    remove: async (id: string) => { await mutate('DELETE', { id }); },
  };
}
