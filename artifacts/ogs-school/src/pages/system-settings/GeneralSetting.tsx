import { useState, useEffect } from 'react';
import { Settings, Save, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const INPUT_CLASS =
  'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

const EMPTY_FORM = {
  school_name: '',
  school_code: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  principal_name: '',
  school_type: 'Public',
  established_year: '',
  logo_url: '',
  motto: '',
};

export default function GeneralSetting() {
  const { profile } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    fetchSettings();
  }, [profile?.school_id]);

  async function fetchSettings() {
    if (!profile?.school_id) return;
    setLoading(true);

    const [schoolRes, settingsRes] = await Promise.all([
      supabase.from('schools').select('name, address, phone, email, logo_url, motto, established_year').eq('id', profile.school_id).maybeSingle(),
      supabase.from('system_settings').select('setting_key, setting_value').eq('school_id', profile.school_id).eq('setting_group', 'general'),
    ]);

    const school = schoolRes.data;
    const settingsMap: Record<string, string> = {};
    (settingsRes.data ?? []).forEach((row: { setting_key: string; setting_value: string }) => {
      settingsMap[row.setting_key] = row.setting_value;
    });

    setForm({
      school_name: settingsMap.school_name || school?.name || '',
      school_code: settingsMap.school_code || '',
      address: settingsMap.address || school?.address || '',
      phone: settingsMap.phone || school?.phone || '',
      email: settingsMap.email || school?.email || '',
      website: settingsMap.website || '',
      principal_name: settingsMap.principal_name || '',
      school_type: settingsMap.school_type || 'Public',
      established_year: settingsMap.established_year || (school?.established_year ? String(school.established_year) : ''),
      logo_url: settingsMap.logo_url || school?.logo_url || '',
      motto: settingsMap.motto || school?.motto || '',
    });

    setLoading(false);
  }

  async function handleSave() {
    if (!profile?.school_id) return;
    setSaving(true);

    const schoolUpdate = supabase.from('schools').update({
      name: form.school_name,
      address: form.address,
      phone: form.phone,
      email: form.email,
      logo_url: form.logo_url,
      motto: form.motto,
      established_year: form.established_year ? parseInt(form.established_year) : null,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.school_id);

    const rows = Object.entries(form).map(([key, value]) => ({
      school_id: profile.school_id,
      setting_group: 'general',
      setting_key: key,
      setting_value: value,
    }));
    const settingsUpsert = supabase.from('system_settings').upsert(rows, { onConflict: 'school_id,setting_key' });

    const [schoolRes, settingsRes] = await Promise.all([schoolUpdate, settingsUpsert]);
    setSaving(false);

    if (schoolRes.error || settingsRes.error) {
      showToast((schoolRes.error?.message || settingsRes.error?.message) ?? 'Error saving settings', 'error');
    } else {
      showToast('Settings saved successfully.');
      // Notify other components (like Sidebar)
      window.dispatchEvent(new CustomEvent('school-logo-updated', { detail: { logo_url: form.logo_url } }));
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.school_id) return;

    setSaving(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.school_id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      setForm(prev => ({ ...prev, logo_url: publicUrl }));
      showToast('Logo uploaded. Remember to Save Settings.');
    } catch (err: any) {
      showToast(err.message || 'Error uploading logo', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Settings className="w-5 h-5 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-app-text">General Settings</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {toast && (
        <div className={`text-sm px-4 py-3 rounded-xl border ${toastType === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {toast}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-app-text-muted text-sm">Loading settings...</div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border p-6">
          <h2 className="text-base font-semibold text-app-text mb-5">School Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">School Name</label>
              <input
                className={INPUT_CLASS}
                value={form.school_name}
                onChange={(e) => setForm({ ...form, school_name: e.target.value })}
                placeholder="Enter school name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">School Code</label>
              <input
                className={INPUT_CLASS}
                value={form.school_code}
                onChange={(e) => setForm({ ...form, school_code: e.target.value })}
                placeholder="e.g. SCH-001"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-app-text-muted mb-1">Address</label>
              <textarea
                className={INPUT_CLASS}
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Full school address"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Phone</label>
              <input
                className={INPUT_CLASS}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 234 567 8900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Email</label>
              <input
                type="email"
                className={INPUT_CLASS}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@school.edu"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">School Motto</label>
              <input
                className={INPUT_CLASS}
                value={form.motto}
                onChange={(e) => setForm({ ...form, motto: e.target.value })}
                placeholder="e.g. Excellence in Education"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Website</label>
              <input
                className={INPUT_CLASS}
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://www.school.edu"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Principal Name</label>
              <input
                className={INPUT_CLASS}
                value={form.principal_name}
                onChange={(e) => setForm({ ...form, principal_name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">School Type</label>
              <select
                className={INPUT_CLASS}
                value={form.school_type}
                onChange={(e) => setForm({ ...form, school_type: e.target.value })}
              >
                <option value="Public">Public</option>
                <option value="Private">Private</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Established Year</label>
              <input
                type="number"
                className={INPUT_CLASS}
                value={form.established_year}
                onChange={(e) => setForm({ ...form, established_year: e.target.value })}
                placeholder="e.g. 1985"
                min="1800"
                max={new Date().getFullYear()}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-app-text-muted mb-1">School Logo</label>
              <div className="flex items-start gap-4 p-4 border-2 border-dashed border-app-border rounded-2xl bg-app-surface-alt/50 hover:bg-app-surface-alt transition-colors">
                <div className="h-16 w-16 bg-app-surface rounded-xl border border-app-border flex items-center justify-center overflow-hidden flex-shrink-0">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo Preview" className="h-full w-full object-contain" />
                  ) : (
                    <Upload className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-app-text">Upload New Logo</p>
                  <p className="text-[10px] text-app-text-muted mt-0.5">Recommended: Square PNG or JPG (Max 2MB)</p>
                  <div className="mt-3 flex items-center gap-3">
                    <label className="cursor-pointer bg-app-surface border border-app-border text-app-text-muted px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-app-surface-alt transition-colors flex items-center gap-2">
                      <Upload className="w-3 h-3" />
                      Browse Files
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={saving} />
                    </label>
                    {form.logo_url && (
                      <button 
                        onClick={() => setForm({ ...form, logo_url: '' })}
                        className="text-[10px] text-red-500 hover:underline"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-app-text-muted mb-1">External Logo URL (Alternative)</label>
              <input
                className={INPUT_CLASS}
                value={form.logo_url}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
