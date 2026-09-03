import { useEffect, useState } from 'react';
import { School, GraduationCap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';

export default function SchoolSetup() {
  const { profile, refreshProfile } = useAuth();
  const { settings } = useTenantSettings();
  const [schools, setSchools] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    supabase.from('schools').select('*').then(({ data }) => setSchools(data ?? []));
  }, []);

  async function assignSchool(schoolId: string) {
    setSaving(true);
    const res = await supabase.rpc('update_profile', {
      p_id: profile?.id ?? '',
      p_payload: { school_id: schoolId }
    });
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    await refreshProfile();
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Welcome to {settings.school_name || 'School Portal'}</h2>
          <p className="text-slate-500 text-sm mt-1">Select your school to continue</p>
        </div>
        <div className="space-y-3">
          {schools.map(school => (
            <button
              key={school.id}
              onClick={() => assignSchool(school.id)}
              disabled={saving}
              className="w-full flex items-center gap-4 p-4 border border-slate-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left group"
            >
              <div className="w-10 h-10 bg-slate-100 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                <School className="w-5 h-5 text-slate-500 group-hover:text-emerald-600 transition-colors" />
              </div>
              <div>
                <p className="font-medium text-slate-800">{school.name}</p>
                <p className="text-xs text-slate-500">{school.address}</p>
              </div>
            </button>
          ))}
        </div>
        {saving && <p className="text-center text-sm text-slate-500 mt-4">Setting up your account...</p>}
        {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mt-4">{saveError}</div>}
      </div>
    </div>
  );
}
