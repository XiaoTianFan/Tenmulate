import { useCallback, useEffect, useRef, useState } from 'react';
import bundled from '../content/project-configs.json';
import { PROJECT_CONFIGS_ENDPOINT, validateProjectConfigs, type ConfigChange, type ProjectConfigs } from '../storage/projectConfigs';
type Snapshot = ProjectConfigs & { revision: string };
export function useProjectConfigs() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ ...validateProjectConfigs(bundled), revision: '' });
  const current = useRef(snapshot), generation = useRef(0);
  const [writable, setWritable] = useState(false);
  const accept = (value: Snapshot) => {
    validateProjectConfigs(value); if (!value.revision) throw new Error('Invalid configuration response.');
    current.current = value; setSnapshot(value); setWritable(true);
  };
  const refresh = useCallback(async () => {
    if (!import.meta.env.DEV) return;
    const token = ++generation.current;
    try {
      const response = await fetch(PROJECT_CONFIGS_ENDPOINT, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const value = await response.json(); if (token === generation.current) accept(value);
    } catch { if (token === generation.current) setWritable(false); }
  }, []);
  useEffect(() => { void refresh(); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, [refresh]);
  const save = async (change: ConfigChange) => {
    if (!import.meta.env.DEV || !current.current.revision) throw new Error('Project configuration storage is unavailable.');
    ++generation.current;
    const response = await fetch(PROJECT_CONFIGS_ENDPOINT, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Tenmulate-Project': '1' }, body: JSON.stringify({ change, revision: current.current.revision }) });
    if (!response.ok) { const error = await response.json().catch(() => null); if (response.status === 409) await refresh(); throw new Error(error?.error ?? 'Configuration save failed.'); }
    accept(await response.json());
  };
  return { snapshot, writable, refresh, save };
}
