import { useState, useRef } from 'react';
import { Database, Image, HardDrive, Upload, Download, Info, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'info' | 'warning';
}

let toastId = 0;

export default function Backup() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  function addToast(message: string, type: Toast['type'] = 'success') {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  function triggerFakeDownload(filename: string) {
    const blob = new Blob([''], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast(`${filename} download started.`, 'success');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setRestoreFile(file);
  }

  function handleUpload() {
    addToast('Feature coming soon. Restore functionality is not yet implemented.', 'info');
    setRestoreFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const backupDate = now.toISOString().slice(0, 10).replace(/-/g, '');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-emerald-50 p-2 rounded-lg">
          <HardDrive className="text-emerald-600" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Backup & Restore</h1>
          <p className="text-sm text-slate-500">Manage system backups and data restoration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Info size={13} className="text-slate-400" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Software Version</span>
          </div>
          <p className="text-xl font-bold text-slate-800">1.0.0</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Info size={13} className="text-slate-400" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Last Backup</span>
          </div>
          <p className="text-sm font-semibold text-slate-800">{formattedDate}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Info size={13} className="text-slate-400" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Storage Used</span>
          </div>
          <p className="text-xl font-bold text-slate-800">N/A</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-emerald-50 p-3 rounded-xl">
              <Database className="text-emerald-600" size={22} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-800">Database Backup</h2>
              <p className="text-xs text-slate-500 mt-0.5">Export all database tables and records as a compressed archive.</p>
            </div>
          </div>
          <button
            onClick={() => triggerFakeDownload(`db_backup_${backupDate}.sql.gz`)}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
          >
            <Download size={15} />
            Download Database
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-sky-50 p-3 rounded-xl">
              <Image className="text-sky-500" size={22} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-800">Images Backup</h2>
              <p className="text-xs text-slate-500 mt-0.5">Download all uploaded images and media files from storage.</p>
            </div>
          </div>
          <button
            onClick={() => triggerFakeDownload(`images_backup_${backupDate}.zip`)}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors"
          >
            <Download size={15} />
            Download Images
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-amber-50 p-3 rounded-xl">
              <HardDrive className="text-amber-500" size={22} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-800">Full System Backup</h2>
              <p className="text-xs text-slate-500 mt-0.5">Download a complete backup including database, files, and configuration.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">This archive can be large and may take a moment to prepare. Ensure you have sufficient storage space.</p>
          </div>
          <button
            onClick={() => triggerFakeDownload(`full_backup_${backupDate}.tar.gz`)}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
          >
            <Download size={15} />
            Download Full Backup
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-slate-100 p-3 rounded-xl">
              <Upload className="text-slate-500" size={22} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-800">Restore Backup</h2>
              <p className="text-xs text-slate-500 mt-0.5">Upload a previously exported backup file to restore the system.</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Select backup file</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gz,.zip,.tar,.sql,.bak"
              onChange={handleFileChange}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
            />
            {restoreFile && (
              <p className="text-xs text-slate-500 mt-1.5">Selected: <span className="font-medium text-slate-700">{restoreFile.name}</span></p>
            )}
          </div>
          <button
            onClick={handleUpload}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
          >
            <Upload size={15} />
            Upload & Restore
          </button>
        </div>
      </div>

      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white'
                : toast.type === 'warning'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-800 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0" />
            ) : toast.type === 'warning' ? (
              <AlertTriangle size={16} className="shrink-0" />
            ) : (
              <Info size={16} className="shrink-0" />
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
