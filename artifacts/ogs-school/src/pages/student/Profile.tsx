import { useState, useEffect } from 'react';
import { User, Phone, Mail, MapPin, Calendar, Droplet, BookOpen, GraduationCap, CreditCard as Edit2, X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function StudentProfile() {
  const { profile } = useAuth();
  const [studentData, setStudentData] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ 
    phone: '', 
    address: '',
    date_of_birth: ''
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    async function load() {
      if (!profile?.id) return;
      const [profileRes, enrollRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', profile.id).maybeSingle(),
        supabase.from('student_enrollments').select('*, classes(id, name, level, section, academic_year_id, academic_years(name))').eq('student_id', profile.id).eq('status', 'active').maybeSingle(),
      ]);
      setStudentData(profileRes.data);
      setEnrollment(enrollRes.data);
      const classId = (enrollRes.data?.classes as any)?.id;
      if (classId) {
        const { data: subData } = await supabase
          .from('class_subjects')
          .select('*, subjects(id, name, code, type)')
          .eq('class_id', classId);
        setSubjects(subData ?? []);
      }
      setEditForm({ 
        phone: profileRes.data?.phone || '', 
        address: profileRes.data?.address || '',
        date_of_birth: profileRes.data?.date_of_birth || ''
      });
      setLoading(false);
    }
    load();
  }, [profile]);

  async function handleSave() {
    if (!profile?.id) return;
    setSaving(true);
    const res = await supabase.rpc('update_profile', {
      p_id: profile.id,
      p_payload: { 
        phone: editForm.phone, 
        address: editForm.address,
        date_of_birth: editForm.date_of_birth
      }
    });
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setStudentData((prev: any) => ({ 
      ...prev, 
      phone: editForm.phone, 
      address: editForm.address,
      date_of_birth: editForm.date_of_birth
    }));
    setSaving(false);
    setEditOpen(false);
  }

  const cls = enrollment?.classes as any;
  const academicYear = cls?.academic_years?.name || '';
  const className = cls ? `${cls.level || ''}${cls.section ? '-' + cls.section : ''}` : '';

  const subjectColors = ['bg-emerald-50 text-emerald-700 border-emerald-100', 'bg-blue-50 text-blue-700 border-blue-100', 'bg-violet-50 text-violet-700 border-violet-100', 'bg-amber-50 text-amber-700 border-amber-100', 'bg-rose-50 text-rose-700 border-rose-100', 'bg-cyan-50 text-cyan-700 border-cyan-100'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-text">My Profile</h1>
        {academicYear && (
          <span className="bg-emerald-100 text-emerald-700 text-sm font-semibold px-4 py-1.5 rounded-full">
            {academicYear}
          </span>
        )}
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-24" />
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-10 mb-4">
            <div className="w-20 h-20 rounded-2xl bg-app-surface border-4 border-white shadow-md flex items-center justify-center text-2xl font-bold text-emerald-600">
              {studentData?.first_name?.[0]}{studentData?.last_name?.[0]}
            </div>
            <button
              onClick={() => { setEditOpen(true); setSaveError(''); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-sm rounded-xl transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </button>
          </div>
          <div>
            <h2 className="text-xl font-bold text-app-text">{studentData?.first_name} {studentData?.last_name}</h2>
            <p className="text-sm text-app-text-muted mt-0.5">{studentData?.email}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-6">
          <h3 className="font-semibold text-app-text mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600" />
            Personal Information
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-app-surface-alt rounded-xl p-3">
                <p className="text-xs text-app-text-muted mb-0.5">Admission No.</p>
                <p className="text-sm font-semibold text-app-text">{studentData?.admission_number || '—'}</p>
              </div>
              <div className="bg-app-surface-alt rounded-xl p-3">
                <p className="text-xs text-app-text-muted mb-0.5">Roll Number</p>
                <p className="text-sm font-semibold text-app-text">{studentData?.roll_number || enrollment?.roll_number || '—'}</p>
              </div>
              <div className="bg-app-surface-alt rounded-xl p-3">
                <p className="text-xs text-app-text-muted mb-0.5">Class</p>
                <p className="text-sm font-semibold text-app-text">{className || '—'}</p>
              </div>
              <div className="bg-app-surface-alt rounded-xl p-3">
                <p className="text-xs text-app-text-muted mb-0.5">Section</p>
                <p className="text-sm font-semibold text-app-text">{cls?.section || '—'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-app-surface-alt rounded-xl p-3 flex items-start gap-2">
                <Calendar className="w-4 h-4 text-app-text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-app-text-muted mb-0.5">Date of Birth</p>
                  <p className="text-sm font-semibold text-app-text">{studentData?.date_of_birth ? new Date(studentData.date_of_birth).toLocaleDateString() : '—'}</p>
                </div>
              </div>
              <div className="bg-app-surface-alt rounded-xl p-3 flex items-start gap-2">
                <User className="w-4 h-4 text-app-text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-app-text-muted mb-0.5">Gender</p>
                  <p className="text-sm font-semibold text-app-text capitalize">{studentData?.gender || '—'}</p>
                </div>
              </div>
              <div className="bg-app-surface-alt rounded-xl p-3 flex items-start gap-2">
                <Droplet className="w-4 h-4 text-app-text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-app-text-muted mb-0.5">Blood Group</p>
                  <p className="text-sm font-semibold text-app-text">{studentData?.blood_group || '—'}</p>
                </div>
              </div>
              <div className="bg-app-surface-alt rounded-xl p-3 flex items-start gap-2">
                <Phone className="w-4 h-4 text-app-text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-app-text-muted mb-0.5">Phone</p>
                  <p className="text-sm font-semibold text-app-text">{studentData?.phone || '—'}</p>
                </div>
              </div>
            </div>
            <div className="bg-app-surface-alt rounded-xl p-3 flex items-start gap-2">
              <Mail className="w-4 h-4 text-app-text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-app-text-muted mb-0.5">Email</p>
                <p className="text-sm font-semibold text-app-text">{studentData?.email || '—'}</p>
              </div>
            </div>
            <div className="bg-app-surface-alt rounded-xl p-3 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-app-text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-app-text-muted mb-0.5">Address</p>
                <p className="text-sm font-semibold text-app-text">{studentData?.address || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-6">
            <h3 className="font-semibold text-app-text mb-4 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              Guardian Information
            </h3>
            <div className="space-y-3">
              <div className="bg-app-surface-alt rounded-xl p-3">
                <p className="text-xs text-app-text-muted mb-0.5">Guardian Name</p>
                <p className="text-sm font-semibold text-app-text">{studentData?.guardian_name || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-app-surface-alt rounded-xl p-3">
                  <p className="text-xs text-app-text-muted mb-0.5">Relation</p>
                  <p className="text-sm font-semibold text-app-text capitalize">{studentData?.guardian_relation || '—'}</p>
                </div>
                <div className="bg-app-surface-alt rounded-xl p-3">
                  <p className="text-xs text-app-text-muted mb-0.5">Phone</p>
                  <p className="text-sm font-semibold text-app-text">{studentData?.guardian_phone || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-app-text flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                Enrolled Subjects
              </h3>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                {subjects.length} Subjects
              </span>
            </div>
            {subjects.length === 0 ? (
              <p className="text-sm text-app-text-muted text-center py-4">No subjects assigned</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {subjects.map((sa, i) => {
                  const sub = sa.subjects as any;
                  const colorClass = subjectColors[i % subjectColors.length];
                  return (
                    <div key={sa.id} className={`border rounded-xl px-3 py-2 ${colorClass}`}>
                      <p className="text-xs font-semibold">{sub?.name || '—'}</p>
                      {sub?.code && <p className="text-xs opacity-70">{sub.code}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {editOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-app-surface rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-app-border">
              <h3 className="font-semibold text-app-text">Edit Profile</h3>
              <button onClick={() => setEditOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-app-text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
              <div>
                <label className="block text-sm font-medium text-app-text mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-app-text mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  value={editForm.date_of_birth}
                  onChange={e => setEditForm(f => ({ ...f, date_of_birth: e.target.value }))}
                  className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-text mb-1.5">Address</label>
                <textarea
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  rows={3}
                  className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  placeholder="Enter address"
                />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-app-border">
              <button onClick={() => setEditOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-app-text-muted bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
