import { useRef, useState } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  currentUrl?: string;
  name: string;
  folder: string;
  onUploaded: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function PhotoUpload({ currentUrl, name, folder, onUploaded, size = 'md' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>(currentUrl ?? '');
  const [error, setError] = useState('');

  const dims = size === 'sm' ? 'w-16 h-16' : size === 'lg' ? 'w-28 h-28' : 'w-20 h-20';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB');
      return;
    }

    setError('');
    setUploading(true);

    const ext = file.name.split('.').pop();
    const path = `${folder}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('profile-photos')
      .upload(path, file, { 
        upsert: true,
        cacheControl: '31536000' // Cache for 1 year
      });

    if (upErr) {
      setError(upErr.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('profile-photos').getPublicUrl(path);
    const url = data.publicUrl;
    setPreview(url);
    onUploaded(url);
    setUploading(false);
  }

  return (
    <div className="relative inline-block">
      <div
        className={`${dims} rounded-2xl bg-slate-100 border-4 border-white shadow-md flex items-center justify-center overflow-hidden cursor-pointer group`}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <>
            <img src={preview} alt={name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </>
        ) : (
          <>
            <span className="text-xl font-bold text-app-text-muted group-hover:hidden">{initials}</span>
            <div className="hidden group-hover:flex flex-col items-center gap-1">
              <Upload className="w-5 h-5 text-app-text-muted" />
              <span className="text-xs text-app-text-muted">Upload</span>
            </div>
          </>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-app-surface/70 flex items-center justify-center rounded-xl">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center shadow-sm transition-colors"
      >
        <Camera className="w-3 h-3 text-white" />
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {error && (
        <div className="absolute top-full mt-1 left-0 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-2 py-1 whitespace-nowrap flex items-center gap-1">
          <X className="w-3 h-3" />{error}
        </div>
      )}
    </div>
  );
}
