import { message as translateMessage } from '../i18n/locale';
import { CloudOff, Download, RefreshCw, Wifi } from 'lucide-react';
import { usePwaStatus } from '../app/pwaStatus';

export function OfflineStatus() {
  const status = usePwaStatus();
  const Icon = !status.online ? CloudOff : status.needsRefresh ? RefreshCw : status.offlineReady ? Download : Wifi;
  const label = !status.online
    ? status.offlineReady ? 'Offline · Cached shell ready' : 'Offline · Cache unavailable'
    : status.needsRefresh ? 'Update ready after restart'
    : status.offlineReady ? 'Local only · Ready offline' : 'Local only · Preparing offline cache';
  return <div className="rail-status" data-state={status.error ? 'error' : 'ok'} title={translateMessage(status.error ?? undefined)}><Icon size={13} /> {translateMessage(label)}</div>;
}
