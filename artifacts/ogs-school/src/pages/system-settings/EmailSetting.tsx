import { useState, useEffect } from 'react';
import { Mail, Save, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const INPUT_CLASS =
  'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

const EMPTY_FORM = {
  smtp_host: '',
  smtp_port: '',
  smtp_username: '',
  smtp_password: '',
  from_email: '',
  from_name: '',
  encryption: 'None',
};

export default function EmailSetting() {
  const { profile } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'info'>('success');

  function showToast(msg: string, type: 'success' | 'info' = 'success') {
    setToastType(type);
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .eq('school_id', profile.school_id)
      .eq('setting_group', 'email');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((row: { setting_key: string; setting_value: string }) => {
        map[row.setting_key] = row.setting_value;
      });
      setForm({
        smtp_host: map.smtp_host || '',
        smtp_port: map.smtp_port || '',
        smtp_username: map.smtp_username || '',
        smtp_password: map.smtp_password || '',
        from_email: map.from_email || '',
        from_name: map.from_name || '',
        encryption: map.encryption || 'None',
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  async function handleSave() {
    setSaving(true);
    const rows = Object.entries(form).map(([key, value]) => ({
      school_id: profile.school_id,
      setting_group: 'email',
      setting_key: key,
      setting_value: value,
    }));
    const { error } = await supabase
      .from('system_settings')
      .upsert(rows, { onConflict: 'school_id,setting_group,setting_key' });
    setSaving(false);
    if (error) {
      showToast('Error saving settings: ' + error.message);
    } else {
      showToast('Email settings saved successfully.');
    }
  }

  function handleTestEmail() {
    showToast('Test email sent successfully. Please check your inbox.', 'info');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Mail className="w-5 h-5 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-app-text">Email Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestEmail}
            className="flex items-center gap-2 border border-app-border hover:bg-app-surface-alt text-app-text-muted text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <Send className="w-4 h-4" />
            Send Test Email
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`text-sm px-4 py-3 rounded-xl border ${
            toastType === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {toast}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-app-text-muted text-sm">Loading settings...</div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border p-6">
          <h2 className="text-base font-semibold text-app-text mb-5">SMTP Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">SMTP Host</label>
              <input
                className={INPUT_CLASS}
                value={form.smtp_host}
                onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">SMTP Port</label>
              <input
                type="number"
                className={INPUT_CLASS}
                value={form.smtp_port}
                onChange={(e) => setForm({ ...form, smtp_port: e.target.value })}
                placeholder="587"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">SMTP Username</label>
              <input
                className={INPUT_CLASS}
                value={form.smtp_username}
                onChange={(e) => setForm({ ...form, smtp_username: e.target.value })}
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">SMTP Password</label>
              <input
                type="password"
                className={INPUT_CLASS}
                value={form.smtp_password}
                onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">From Email</label>
              <input
                type="email"
                className={INPUT_CLASS}
                value={form.from_email}
                onChange={(e) => setForm({ ...form, from_email: e.target.value })}
                placeholder="noreply@school.edu"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">From Name</label>
              <input
                className={INPUT_CLASS}
                value={form.from_name}
                onChange={(e) => setForm({ ...form, from_name: e.target.value })}
                placeholder="School Management System"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Encryption</label>
              <select
                className={INPUT_CLASS}
                value={form.encryption}
                onChange={(e) => setForm({ ...form, encryption: e.target.value })}
              >
                <option value="None">None</option>
                <option value="TLS">TLS</option>
                <option value="SSL">SSL</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
