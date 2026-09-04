import { useEffect, useRef, useState } from 'react';
import { Save, School, Upload, KeyRound, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { School as SchoolType } from '../../lib/types';

const inputCls = 'bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30';

export default function Settings() {
  const { profile } = useAuth();
  const [school, setSchool] = useState<SchoolType | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', motto: '', established_year: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => { loadSchool(); }, [profile]);

  async function loadSchool() {
    if (!profile?.school_id) return;
    const { data } = await supabase.from('schools').select('*').eq('id', profile.school_id).maybeSingle();
    if (data) {
      setSchool(data);
      setForm({ name: data.name, address: data.address, phone: data.phone, email: data.email, motto: data.motto, established_year: String(data.established_year) });
      setLogoUrl(data.logo_url ?? '');
    }
  }

  async function handleSave() {
    if (!school) return;
    setSaving(true);
    const res = await supabase.from('schools').update({ ...form, established_year: parseInt(form.established_year), updated_at: new Date().toISOString() }).eq('id', school.id);
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !school) return;
    setLogoError('');
    setLogoUploading(true);

    const ext = file.name.split('.').pop();
    const path = `${school.id}/logo.${ext}`;

    const { error: uploadErr } = await supabase.storage.from('school-logos').upload(path, file, { upsert: true });
    if (uploadErr) { setLogoError(uploadErr.message); setLogoUploading(false); return; }

    const { data: urlData } = supabase.storage.from('school-logos').getPublicUrl(path);
    const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;

    const { error: updateErr } = await supabase.from('schools').update({ logo_url: publicUrl }).eq('id', school.id);
    if (updateErr) { setLogoError(updateErr.message); setLogoUploading(false); return; }

    setLogoUrl(publicUrl);
    setSchool({ ...school, logo_url: publicUrl });
    setLogoUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    window.dispatchEvent(new CustomEvent('school-logo-updated', { detail: { logo_url: publicUrl } }));
  }

  async function handleChangePassword() {
    setPwError('');
    if (!pwForm.newPw) { setPwError('New password is required.'); return; }
    if (pwForm.newPw.length < 6) { setPwError('Password must be at least 6 characters.'); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('New passwords do not match.'); return; }

    setPwSaving(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: profile?.email ?? '', password: pwForm.current });
    if (signInErr) { setPwError('Current password is incorrect.'); setPwSaving(false); return; }

    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
    if (error) { setPwError(error.message); setPwSaving(false); return; }

    setPwSaved(true);
    setPwForm({ current: '', newPw: '', confirm: '' });
    setTimeout(() => setPwSaved(false), 3000);
    setPwSaving(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-app-text">School Settings</h2>
        <p className="text-app-text-muted text-sm">Manage school information and configuration</p>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
        <div className="flex items-center gap-3 p-5 border-b border-app-border">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
            <School className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-app-text">School Information</p>
            <p className="text-xs text-app-text-muted">Update basic school details</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">School Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Address</label>
            <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">School Motto</label>
              <input value={form.motto} onChange={e => setForm({...form, motto: e.target.value})} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Established Year</label>
              <input type="number" value={form.established_year} onChange={e => setForm({...form, established_year: e.target.value})} className={inputCls} />
            </div>
          </div>
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{saveError}</div>}
          <div className="flex justify-end pt-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
        <div className="flex items-center gap-3 p-5 border-b border-app-border">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
            <Upload className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-app-text">School Logo</p>
            <p className="text-xs text-app-text-muted">Upload a logo to display in the sidebar and on printed documents</p>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-app-border flex items-center justify-center overflow-hidden bg-app-surface-alt">
                {logoUrl ? (
                  <img src={logoUrl} alt="School logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <School className="w-8 h-8 text-slate-300" />
                )}
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-sm text-app-text-muted">
                Accepted formats: JPEG, PNG, WebP, SVG. Maximum size: 5MB.
              </p>
              {logoError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{logoError}</div>}
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <label
                  htmlFor="logo-upload"
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${logoUploading ? 'bg-slate-100 text-app-text-muted cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
                >
                  <Upload className="w-4 h-4" />
                  {logoUploading ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Logo'}
                </label>
                {logoUrl && (
                  <button
                    onClick={async () => {
                      if (!school) return;
                      await supabase.from('schools').update({ logo_url: '' }).eq('id', school.id);
                      setLogoUrl('');
                      setSchool({ ...school, logo_url: '' });
                      window.dispatchEvent(new CustomEvent('school-logo-updated', { detail: { logo_url: '' } }));
                    }}
                    className="text-sm text-red-500 hover:text-red-600 font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5">
        <h3 className="font-semibold text-app-text mb-3">Account Information</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-app-text-muted">Name</span>
            <span className="text-app-text font-medium">{profile?.first_name} {profile?.last_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-app-text-muted">Email</span>
            <span className="text-app-text">{profile?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-app-text-muted">Role</span>
            <span className="text-app-text capitalize">{profile?.role?.replace('_', ' ')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-app-text-muted">Account Created</span>
            <span className="text-app-text">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</span>
          </div>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
        <div className="flex items-center gap-3 p-5 border-b border-app-border">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-app-text">Change Password</p>
            <p className="text-xs text-app-text-muted">Update your account password</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={pwForm.current}
                onChange={e => setPwForm({...pwForm, current: e.target.value})}
                className={`${inputCls} pr-10`}
                placeholder="Enter current password"
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={pwForm.newPw}
                onChange={e => setPwForm({...pwForm, newPw: e.target.value})}
                className={`${inputCls} pr-10`}
                placeholder="Enter new password (min 6 characters)"
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={pwForm.confirm}
                onChange={e => setPwForm({...pwForm, confirm: e.target.value})}
                className={`${inputCls} pr-10`}
                placeholder="Re-enter new password"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {pwError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{pwError}</div>}
          {pwSaved && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">Password updated successfully.</div>}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleChangePassword}
              disabled={pwSaving || !pwForm.current || !pwForm.newPw || !pwForm.confirm}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              {pwSaving ? 'Saving...' : 'Save Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
