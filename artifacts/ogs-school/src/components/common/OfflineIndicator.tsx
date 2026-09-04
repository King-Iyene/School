import { Wifi, WifiOff, RefreshCw, CloudOff, CheckCircle } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useState } from 'react';

export default function OfflineIndicator() {
  const { isOnline, pendingCount, syncing, lastSyncTime, triggerSync } = useNetworkStatus();
  const [showDetails, setShowDetails] = useState(false);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      {showDetails && pendingCount > 0 && (
        <div className="bg-slate-800 text-white text-xs rounded-xl px-4 py-3 shadow-xl border border-slate-700 max-w-xs text-center">
          <p className="font-medium mb-1">
            {pendingCount} attendance record{pendingCount !== 1 ? 's' : ''} pending sync
          </p>
          {lastSyncTime && (
            <p className="text-app-text-muted">Last synced: {lastSyncTime.toLocaleTimeString()}</p>
          )}
          {isOnline && (
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="mt-2 flex items-center gap-1.5 mx-auto bg-app-primary hover:opacity-90 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      )}

      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all ${
          !isOnline
            ? 'bg-red-500 text-white'
            : pendingCount > 0
            ? 'bg-amber-500 text-white'
            : 'bg-emerald-500 text-white'
        }`}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Offline</span>
          </>
        ) : syncing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Syncing...</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <CloudOff className="w-4 h-4" />
            <span>{pendingCount} pending</span>
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4" />
            <span>Synced</span>
          </>
        )}
      </button>
    </div>
  );
}
