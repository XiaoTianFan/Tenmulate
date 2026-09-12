import { useCallback, useEffect, useRef, useState } from 'react';
import bundledCatalog from '../content/project-drills.json';
import type { DrillDefinitionV2 } from '../content/types';
import { PROJECT_DRILLS_ENDPOINT, validateProjectCatalog, type ProjectCatalogSnapshot } from '../storage/projectCatalog';

const packaged = validateProjectCatalog(bundledCatalog);
export function useProjectDrills() {
  const [snapshot, setSnapshot] = useState<ProjectCatalogSnapshot>({ ...packaged, revision: '' });
  const [status, setStatus] = useState('Connecting to project…');
  const [writable, setWritable] = useState(false);
  const current = useRef(snapshot), request = useRef(0);
  const accept = useCallback((value: ProjectCatalogSnapshot) => {
    validateProjectCatalog(value);
    if (typeof value.revision !== 'string' || !value.revision) throw new Error('Project server response is invalid.');
    current.current = value; setSnapshot(value); setWritable(true); setStatus('Project catalog');
  }, []);
  const refresh = useCallback(async () => {
    if (!import.meta.env.DEV) return;
    const token = ++request.current;
    try {
      const response = await fetch(PROJECT_DRILLS_ENDPOINT, { cache: 'no-store' });
      if (!response.ok) throw new Error('Project unavailable');
      const value = await response.json();
      if (token === request.current) accept(value);
    } catch {
      if (token === request.current) { setWritable(false); setStatus('Project saving unavailable. Open the local project server to save.'); }
    }
  }, [accept]);
  useEffect(() => { void refresh(); window.addEventListener('focus', refresh); return () => { window.removeEventListener('focus', refresh); }; }, [refresh]);
  const mutate = async (method: 'PUT' | 'DELETE', data: { drill: DrillDefinitionV2 } | { id: string }) => {
    if (!import.meta.env.DEV || !current.current.revision) throw new Error('Project saving is unavailable. Your editor draft is retained.');
    ++request.current;
    const response = await fetch(PROJECT_DRILLS_ENDPOINT, { method, headers: { 'Content-Type': 'application/json', 'X-Tenmulate-Project': '1' },
      body: JSON.stringify({ ...data, revision: current.current.revision }) });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      if (response.status === 409) await refresh();
      throw new Error(error?.error ?? 'Project save failed. Your editor draft is retained.');
    }
    const value = await response.json() as ProjectCatalogSnapshot & { savedId?: string };
    accept(value); return value;
  };
  return { drills: snapshot.drills, writable, status, refresh,
    save: async (drill: DrillDefinitionV2) => {
      const saved = await mutate('PUT', { drill });
      const result = saved.drills.find(item => item.id === saved.savedId);
      if (!result) throw new Error('Project did not acknowledge the saved drill.');
      return result;
    },
    remove: async (id: string) => { await mutate('DELETE', { id }); },
  };
}
