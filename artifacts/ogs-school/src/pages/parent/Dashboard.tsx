import { useEffect, useState } from 'react';
import { Users, Award, UserCheck, DollarSign, BookOpen, Plus, Search, X, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import DashboardCalendar from '../../components/dashboard/DashboardCalendar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../components/hooks/useLocation';
import { createPortal } from 'react-dom';

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  student_id?: string;
  admission_number?: string;
}

interface ChildStats {
  avg: number;
  attRate: number;
  className: string;
}

interface Link {
  id: string;
  relationship: string;
  student_id: string;
}

export default function ParentDashboard() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [stats, setStats] = useState<Record<string, ChildStats>>({});
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Link child modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [admissionInput, setAdmissionInput] = useState('');
  const [relationship, setRelationship] = useState('parent');
  const [searching, setSearching] = useState(false);
  const [foundStudent, setFoundStudent] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState('');

  // Unlink state
  const [unlinking, setUnlinking] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) load();
  }, [profile]);

  async function load() {
    setLoading(true);
    const { data: linkRows } = await supabase
      .from('parent_student_links')
      .select('id, relationship, student_id, students!student_id(id, first_name, last_name, admission_number, student_id)')
      .eq('parent_id', profile!.id);

    const rawLinks = linkRows ?? [];
    const childProfiles: Child[] = rawLinks.map((l: any) => l.students).filter(Boolean);
    setChildren(childProfiles);
    setLinks(rawLinks.map((l: any) => ({ id: l.id, relationship: l.relationship, student_id: l.student_id })));

    const childStats: Record<string, ChildStats> = {};
    for (const child of childProfiles) {
      const [gradeRes, attRes, enrollRes] = await Promise.all([
        supabase.from('grades').select('total_score').eq('student_id', child.id).order('updated_at', { ascending: false }).limit(5),
        supabase.from('student_attendance').select('status').eq('student_id', child.id),
        supabase.from('student_enrollments').select('*, classes(name, level, section)').eq('student_id', child.id).eq('status', 'active').maybeSingle(),
      ]);
      const grades = gradeRes.data ?? [];
      const att = attRes.data ?? [];
      const avg = grades.length > 0 ? Math.round(grades.reduce((s: number, g: any) => s + (g.total_score || 0), 0) / grades.length) : 0;
      const presentCount = att.filter((a: any) => a.status === 'present').length;
      const attRate = att.length > 0 ? Math.round((presentCount / att.length) * 100) : 0;
      const cls = (enrollRes.data?.classes as any);
      const className = cls?.name || (cls ? `${cls.level ?? ''}${cls.section ?? ''}` : 'Class not assigned');
      childStats[child.id] = { avg, attRate, className };
    }
    setStats(childStats);

    const { data: ann } = await supabase
      .from('announcements')
      .select('*')
      .eq('school_id', profile!.school_id ?? '')
      .contains('target_roles', [profile!.role])
      .order('created_at', { ascending: false })
      .limit(5);
    setAnnouncements(ann ?? []);
    setLoading(false);
  }

  async function handleSearch() {
    if (!admissionInput.trim()) return;
    setSearching(true);
    setFoundStudent(null);
    setSearchError('');
    // Uses a safe server-side lookup: parents can't read the students table
    // directly (security rules), so a normal query always returns nothing.
    const { data: rpcData, error } = await supabase
      .rpc('find_student_for_link', { adm: admissionInput.trim().toUpperCase() });
    const data = Array.isArray(rpcData) ? rpcData[0] : rpcData;

    if (error || !data) {
      setSearchError(
        error?.message?.includes('find_student_for_link')
          ? 'Student lookup is not enabled yet. Please contact the school administrator.'
          : 'No student found with that admission number at this school. Please check and try again.'
      );
    } else {
      const alreadyLinked = links.some(l => l.student_id === data.id);
      if (alreadyLinked) {
        setSearchError('This student is already linked to your account.');
      } else {
        setFoundStudent(data);
      }
    }
    setSearching(false);
  }

  async function handleLink() {
    if (!foundStudent) return;
    setLinking(true);
    const { error } = await supabase.from('parent_student_links').insert({
      parent_id: profile!.id,
      student_id: foundStudent.id,
      relationship,
    });
    if (error) {
      setSearchError('Failed to link: ' + error.message);
    } else {
      setLinkSuccess(`${foundStudent.first_name} ${foundStudent.last_name} has been linked to your account.`);
      setFoundStudent(null);
      setAdmissionInput('');
      await load();
    }
    setLinking(false);
  }

  async function handleUnlink(linkId: string, childName: string) {
    if (!confirm(`Remove ${childName} from your account?`)) return;
    setUnlinking(linkId);
    await supabase.from('parent_student_links').delete().eq('id', linkId);
    await load();
    setUnlinking(null);
  }

  function openModal() {
    setShowLinkModal(true);
    setAdmissionInput('');
    setFoundStudent(null);
    setSearchError('');
    setLinkSuccess('');
    setRelationship('parent');
  }

  function closeModal() {
    setShowLinkModal(false);
    setAdmissionInput('');
    setFoundStudent(null);
    setSearchError('');
    setLinkSuccess('');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-app-text">Welcome, {profile?.first_name}!</h2>
        <p className="text-app-text-muted mt-1">Monitor your children's academic progress</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard title="My Children" value={children.length} icon={Users} color="emerald" />
        <StatCard title="Announcements" value={announcements.length} icon={BookOpen} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardCalendar />
        </div>

        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-app-border">
            <h3 className="font-semibold text-app-text">Announcements</h3>
            <button onClick={() => navigate('/announcements')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">View all</button>
          </div>
          <div className="divide-y divide-app-border">
            {announcements.length === 0 ? (
              <div className="p-5 text-center text-app-text-muted text-sm">No announcements</div>
            ) : announcements.map(a => (
              <div key={a.id} className="p-4">
                <p className="text-sm font-medium text-app-text">{a.title}</p>
                <p className="text-xs text-app-text-muted mt-0.5 line-clamp-2">{a.content}</p>
                <p className="text-xs text-app-text-muted mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-app-text flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            My Children
          </h3>
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-app-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Link a Child
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-app-text-muted">Loading...</div>
        ) : children.length === 0 ? (
          <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-8 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-app-text-muted font-medium">No children linked yet</p>
            <p className="text-sm text-app-text-muted mt-1 mb-4">Click "Link a Child" to add your ward using their admission number</p>
            <button onClick={openModal} className="px-5 py-2 bg-app-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-colors">
              Link a Child
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {children.map(child => {
              const link = links.find(l => l.student_id === child.id);
              return (
                <div key={child.id} className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5">
                  <div className="flex items-center gap-4 mb-4 pb-4 border-b border-app-border">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-xl font-bold text-emerald-700 flex-shrink-0">
                      {child.first_name?.[0]}{child.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-app-text text-lg truncate">{child.first_name} {child.last_name}</h3>
                      <p className="text-sm text-app-text-muted">{stats[child.id]?.className || 'Class not assigned'}</p>
                      {child.admission_number && <p className="text-xs text-app-text-muted font-mono">Adm: {child.admission_number}</p>}
                    </div>
                    <button
                      onClick={() => link && handleUnlink(link.id, `${child.first_name} ${child.last_name}`)}
                      disabled={unlinking === link?.id}
                      className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                      title="Remove link"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{stats[child.id]?.avg ?? 0}%</p>
                      <p className="text-xs text-emerald-700 mt-0.5">Average Grade</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{stats[child.id]?.attRate ?? 0}%</p>
                      <p className="text-xs text-blue-700 mt-0.5">Attendance</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => navigate('/grades')} className="flex-1 py-2 text-xs font-medium text-app-text-muted bg-app-surface-alt hover:bg-slate-100 rounded-lg transition-colors">Grades</button>
                    <button onClick={() => navigate('/fees')} className="flex-1 py-2 text-xs font-medium text-app-text-muted bg-app-surface-alt hover:bg-slate-100 rounded-lg transition-colors">Fees</button>
                    <button onClick={() => navigate('/attendance')} className="flex-1 py-2 text-xs font-medium text-app-text-muted bg-app-surface-alt hover:bg-slate-100 rounded-lg transition-colors">Attendance</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Link Child Modal */}
      {showLinkModal && createPortal(
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-app-surface rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-app-border">
              <div>
                <h3 className="font-bold text-app-text text-lg">Link a Child</h3>
                <p className="text-sm text-app-text-muted mt-0.5">Enter your child's admission number</p>
              </div>
              <button onClick={closeModal} className="p-2 text-app-text-muted hover:text-app-text hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {linkSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  {linkSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-app-text mb-1.5">Admission Number</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={admissionInput}
                    onChange={e => { setAdmissionInput(e.target.value); setSearchError(''); setFoundStudent(null); setLinkSuccess(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="e.g. STU/2024/001"
                    className="bg-app-surface text-app-text flex-1 px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-primary focus:border-transparent"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || !admissionInput.trim()}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-app-text rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {searching ? (
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Search
                  </button>
                </div>
              </div>

              {searchError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {searchError}
                </div>
              )}

              {foundStudent && (
                <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-200 flex items-center justify-center text-emerald-800 font-bold text-lg">
                      {foundStudent.first_name?.[0]}{foundStudent.last_name?.[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-app-text">{foundStudent.first_name} {foundStudent.last_name}</p>
                      <p className="text-sm text-app-text-muted">Admission: {foundStudent.admission_number}</p>
                      {foundStudent.student_id && <p className="text-xs text-app-text-muted">Student ID: {foundStudent.student_id}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-app-text mb-1.5">Your Relationship</label>
                    <select
                      value={relationship}
                      onChange={e => setRelationship(e.target.value)}
                      className="w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-primary bg-app-surface"
                    >
                      <option value="parent">Parent</option>
                      <option value="father">Father</option>
                      <option value="mother">Mother</option>
                      <option value="guardian">Guardian</option>
                    </select>
                  </div>

                  <button
                    onClick={handleLink}
                    disabled={linking}
                    className="w-full py-2.5 bg-app-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {linking ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Linking...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Confirm Link
                      </>
                    )}
                  </button>
                </div>
              )}

              <p className="text-xs text-app-text-muted text-center">
                The admission number is on your child's school documents or ID card.
              </p>
            </div>

            <div className="px-5 pb-5">
              <button onClick={closeModal} className="w-full py-2.5 border border-app-border text-app-text-muted rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>,
      document.body
      )}
    </div>
  );
}
