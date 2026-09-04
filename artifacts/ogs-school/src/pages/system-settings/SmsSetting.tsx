import { useState, useEffect } from 'react';
import { MessageSquare, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const INPUT_CLASS =
  'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

const EMPTY_FORM = {
  sms_gateway: 'Twilio',
  api_key: '',
  api_secret: '',
  sender_id: '',
  sms_balance: '',
};

export default function SmsSetting() {
  const { profile } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .eq('school_id', profile.school_id)
      .eq('setting_group', 'sms');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((row: { setting_key: string; setting_value: string }) => {
        map[row.setting_key] = row.setting_value;
      });
      setForm({
        sms_gateway: map.sms_gateway || 'Twilio',
        api_key: map.api_key || '',
        api_secret: map.api_secret || '',
        sender_id: map.sender_id || '',
        sms_balance: map.sms_balance || '',
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
      setting_group: 'sms',
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
      showToast('SMS settings saved successfully.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-app-text">SMS Settings</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-app-text-muted text-sm">Loading settings...</div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border p-6">
          <h2 className="text-base font-semibold text-app-text mb-5">SMS Gateway Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">SMS Gateway</label>
              <select
                className={INPUT_CLASS}
                value={form.sms_gateway}
                onChange={(e) => setForm({ ...form, sms_gateway: e.target.value })}
              >
                <option value="Twilio">Twilio</option>
                <option value="Termii">Termii</option>
                <option value="InfoBip">InfoBip</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Sender ID</label>
              <input
                className={INPUT_CLASS}
                value={form.sender_id}
                onChange={(e) => setForm({ ...form, sender_id: e.target.value })}
                placeholder="SCHOOL"
                maxLength={11}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">API Key</label>
              <input
                type="password"
                className={INPUT_CLASS}
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder="••••••••••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">API Secret</label>
              <input
                type="password"
                className={INPUT_CLASS}
                value={form.api_secret}
                onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
                placeholder="••••••••••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">SMS Balance</label>
              <div className="relative">
                <input
                  className={`${INPUT_CLASS} bg-app-surface-alt text-app-text-muted cursor-not-allowed`}
                  value={form.sms_balance || 'N/A'}
                  readOnly
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-app-text-muted bg-slate-100 px-2 py-0.5 rounded-lg">
                  Read-only
                </span>
              </div>
              <p className="text-xs text-app-text-muted mt-1">Balance is fetched from the gateway automatically.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
