import { useState } from 'react';
import { Palette, RotateCcw, Check, Moon, Sun } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenantSettings } from '../../context/TenantContext';

const DEFAULT_PRIMARY = '#2A0A5C';
const DEFAULT_SECONDARY = '#B679F5';

const PRESETS: { label: string; primary: string; secondary: string }[] = [
  { label: 'SchoolOS (default)', primary: '#2A0A5C', secondary: '#B679F5' },
  { label: 'Forest', primary: '#065f46', secondary: '#10b981' },
  { label: 'Ocean', primary: '#0c4a6e', secondary: '#0ea5e9' },
  { label: 'Crimson', primary: '#7f1d1d', secondary: '#ef4444' },
  { label: 'Sunset', primary: '#7c2d12', secondary: '#f97316' },
];

export default function Appearance() {
  const { tenant, settings, refresh } = useTenantSettings();
  const [primary, setPrimary] = useState(settings.app_primary_color || DEFAULT_PRIMARY);
  const [secondary, setSecondary] = useState(settings.app_secondary_color || DEFAULT_SECONDARY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isCustomized = !!settings.app_primary_color || !!settings.app_secondary_color;

  async function save(newPrimary: string | null, newSecondary: string | null) {
    if (!tenant?.id) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from('tenant_settings')
      .update({ app_primary_color: newPrimary, app_secondary_color: newSecondary })
      .eq('tenant_id', tenant.id);
    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setMessage({ type: 'success', text: 'Appearance updated — every user of your school will see it applied.' });
    await refresh();
  }

  async function reset() {
    setPrimary(DEFAULT_PRIMARY);
    setSecondary(DEFAULT_SECONDARY);
    await save(null, null);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-app-text">Appearance</h1>
        <p className="text-app-text-muted text-sm mt-1">
          Customize your portal's accent colors — applied for every user at your school, in both light and dark mode.
        </p>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-app-text flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4" /> Brand Colors
        </h2>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-app-text mb-2">Primary color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primary}
                onChange={e => setPrimary(e.target.value)}
                className="w-12 h-12 rounded-lg border border-app-border cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={primary}
                onChange={e => setPrimary(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-app-primary/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-2">Secondary color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={secondary}
                onChange={e => setSecondary(e.target.value)}
                className="w-12 h-12 rounded-lg border border-app-border cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={secondary}
                onChange={e => setSecondary(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-app-primary/40"
              />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm font-medium text-app-text mb-2">Presets</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => { setPrimary(p.primary); setSecondary(p.secondary); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-app-border hover:border-app-primary/50 text-xs font-medium text-app-text transition-colors"
              >
                <span className="w-3 h-3 rounded-full" style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm font-medium text-app-text mb-2">Preview</p>
          <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Preview</p>
            <p className="text-white text-lg font-bold">Welcome back, Admin</p>
            <p className="text-white/70 text-sm mt-1">This is how your hero banner and accent color will look.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => save(primary, secondary)}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-app-primary disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {isCustomized && (
            <button
              onClick={reset}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-app-border text-app-text-muted hover:text-app-text text-sm font-medium rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Reset to Default
            </button>
          )}
        </div>
      </div>

      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-app-text flex items-center gap-2 mb-2">
          <Sun className="w-4 h-4" /> <Moon className="w-4 h-4 -ml-1" /> Light &amp; Dark Mode
        </h2>
        <p className="text-sm text-app-text-muted">
          Every user can switch between light, dark, or system theme individually from the sun/moon icon in the top bar — that's a personal preference and isn't affected by the brand colors above.
        </p>
      </div>
    </div>
  );
}
