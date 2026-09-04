import { useState } from 'react';
import { RefreshCw, Database, Server, HardDrive, Clock, CheckCircle2, Package } from 'lucide-react';

export default function UpdateSystem() {
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  function handleCheckUpdates() {
    setChecking(true);
    setChecked(false);
    setTimeout(() => {
      setChecking(false);
      setChecked(true);
    }, 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-app-text">System Update</h1>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center">
              <Package className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-app-text-muted uppercase tracking-wider">Current Version</p>
              <p className="text-3xl font-bold text-app-text mt-0.5">v2.1.0</p>
              <p className="text-xs text-app-text-muted mt-1">School Management System</p>
            </div>
          </div>
          <button
            onClick={handleCheckUpdates}
            disabled={checking}
            className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        {checked && (
          <div className="mt-5 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">You are running the latest version.</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-base font-semibold text-app-text mb-4">System Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-app-surface rounded-2xl border border-app-border p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Database className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xs font-medium text-app-text-muted uppercase tracking-wider">Database</p>
            </div>
            <p className="text-lg font-bold text-app-text">Connected</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-emerald-600 font-medium">Operational</span>
            </div>
          </div>

          <div className="bg-app-surface rounded-2xl border border-app-border p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <Server className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xs font-medium text-app-text-muted uppercase tracking-wider">Server</p>
            </div>
            <p className="text-lg font-bold text-app-text">Running</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-xs text-blue-600 font-medium">Online</span>
            </div>
          </div>

          <div className="bg-app-surface rounded-2xl border border-app-border p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-xs font-medium text-app-text-muted uppercase tracking-wider">Last Backup</p>
            </div>
            <p className="text-lg font-bold text-app-text">Today</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span className="text-xs text-purple-600 font-medium">Auto-backup enabled</span>
            </div>
          </div>

          <div className="bg-app-surface rounded-2xl border border-app-border p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
                <HardDrive className="w-4 h-4 text-orange-600" />
              </div>
              <p className="text-xs font-medium text-app-text-muted uppercase tracking-wider">Storage Used</p>
            </div>
            <p className="text-lg font-bold text-app-text">45%</p>
            <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
              <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: '45%' }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-6">
        <h2 className="text-base font-semibold text-app-text mb-4">Version History</h2>
        <div className="space-y-3">
          {[
            { version: 'v2.1.0', date: 'March 2026', note: 'System settings, weekend management, holiday calendar improvements.' },
            { version: 'v2.0.0', date: 'January 2026', note: 'Major release: Transport, Dormitory, Inventory modules added.' },
            { version: 'v1.5.2', date: 'November 2025', note: 'Bug fixes in Finance module, improved report generation.' },
            { version: 'v1.5.0', date: 'September 2025', note: 'HR module, payroll, and staff management features.' },
          ].map((v, idx) => (
            <div key={v.version} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full border-2 mt-0.5 ${idx === 0 ? 'border-emerald-500 bg-emerald-500' : 'border-app-border bg-app-surface'}`}></div>
                {idx < 3 && <div className="w-0.5 h-8 bg-slate-100 mt-1"></div>}
              </div>
              <div className="pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-app-text">{v.version}</span>
                  {idx === 0 && (
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Current</span>
                  )}
                  <span className="text-xs text-app-text-muted">{v.date}</span>
                </div>
                <p className="text-xs text-app-text-muted mt-0.5">{v.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
