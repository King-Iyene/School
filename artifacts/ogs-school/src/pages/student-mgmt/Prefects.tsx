import { useEffect, useState } from 'react';
import { Shield, Plus, Search, Trash2, CreditCard as Edit2, User, ChevronDown, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const GENDER_BADGE: Record<string, string> = {
  boy:  'bg-blue-100 text-blue-700',
  girl: 'bg-rose-100 text-rose-700',
  any:  'bg-slate-100 text-app-text-muted',
};

const GENDER_LABEL: Record<string, string> = {
  boy:  'Boy',
  girl: 'Girl',
  any:  '',
};

interface Position {
  id: string;
  title: string;
  gender: string;
  category: string;
  sort_order: number;
  is_active: boolean;
}

interface Assignment {
  id: string;
  position_id: string;
  student_id: string;
  academic_year_id: string | null;
  appointed_date: string | null;
  is_active: boolean;
  notes: string | null;
  student_name?: string;
  student_class?: string;
  avatar_url?: string | null;
}

interface AcademicYear {
  id: string;
  name: string;
  is_current: boolean;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number?: string | null;
  avatar_url?: string | null;
}

const EMPTY_POS = { title: '', gender: 'any' as const, category: '', sort_order: 0 };

export default function Prefects() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'principal';

  const [positions, setPositions] = useState<Position[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningPosition, setAssigningPosition] = useState<Position | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<Student[]>([]);
  const [appointedDate, setAppointedDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignNotes, setAssignNotes] = useState('');

  const [showAddPos, setShowAddPos] = useState(false);
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [posForm, setPosForm] = useState({ ...EMPTY_POS });
  const [savingPos, setSavingPos] = useState(false);

  useEffect(() => { loadYears(); }, []);
  useEffect(() => { if (selectedYear) { loadData(); } }, [selectedYear]);

  async function loadYears() {
    const { data } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false });
    setYears(data ?? []);
    const current = (data ?? []).find(y => y.is_current);
    setSelectedYear(current?.id ?? data?.[0]?.id ?? '');
  }

  async function loadData() {
    setLoading(true);
    const [{ data: posData }, { data: assData }] = await Promise.all([
      supabase.from('prefect_positions').select('*').eq('is_active', true).order('sort_order').order('category'),
      supabase.from('prefect_assignments').select('*').eq('academic_year_id', selectedYear).eq('is_active', true),
    ]);

    setPositions(posData ?? []);

    if (assData) {
      const enriched = await Promise.all(assData.map(async (a) => {
        const { data: s } = await supabase.from('students').select('first_name, last_name').eq('id', a.student_id).maybeSingle();
        if (s) return { ...a, student_name: `${s.first_name} ${s.last_name}`, avatar_url: null };
        const { data: p } = await supabase.from('profiles').select('first_name, last_name, avatar_url').eq('id', a.student_id).maybeSingle();
        return { ...a, student_name: p ? `${p.first_name} ${p.last_name}` : 'Unknown', avatar_url: p?.avatar_url ?? null };
      }));
      setAssignments(enriched);
    } else {
      setAssignments([]);
    }
    setLoading(false);
  }

  async function searchStudents(q: string) {
    if (!q.trim()) { setStudentResults([]); return; }
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,admission_number.ilike.%${q}%`)
      .eq('status', 'active')
      .limit(15);
    setStudentResults((data ?? []).map(s => ({ ...s, avatar_url: null })));
  }

  async function assignStudent(student: Student) {
    if (!assigningPosition || !selectedYear) return;
    await supabase.from('prefect_assignments').upsert({
      position_id: assigningPosition.id,
      student_id: student.id,
      academic_year_id: selectedYear,
      appointed_date: appointedDate,
      notes: assignNotes || null,
      is_active: true,
    }, { onConflict: 'position_id,academic_year_id' });
    setShowAssignModal(false);
    setAssigningPosition(null);
    setStudentSearch('');
    setStudentResults([]);
    setAssignNotes('');
    loadData();
  }

  async function removeAssignment(id: string) {
    await supabase.from('prefect_assignments').delete().eq('id', id);
    loadData();
  }

  async function savePosition() {
    if (!posForm.title.trim()) return;
    setSavingPos(true);
    const payload = {
      title: posForm.title.trim(),
      gender: posForm.gender,
      category: posForm.category.trim() || 'General',
      sort_order: posForm.sort_order,
    };
    if (editingPos) {
      await supabase.from('prefect_positions').update(payload).eq('id', editingPos.id);
    } else {
      await supabase.from('prefect_positions').insert({ ...payload, is_active: true });
    }
    setSavingPos(false);
    setShowAddPos(false);
    setEditingPos(null);
    loadData();
  }

  async function deactivatePosition(id: string) {
    await supabase.from('prefect_positions').update({ is_active: false }).eq('id', id);
    loadData();
  }

  const grouped = positions.reduce<Record<string, Position[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] ?? []).push(p);
    return acc;
  }, {});

  function getAssignment(posId: string) {
    return assignments.find(a => a.position_id === posId);
  }

  function Initials({ name, avatarUrl }: { name?: string; avatarUrl?: string | null }) {
    if (avatarUrl) return <img src={avatarUrl} alt={name} className="w-10 h-10 rounded-full object-cover" />;
    const parts = (name ?? '??').split(' ');
    const ini = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
    return <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">{ini}</div>;
  }

  const assignedCount = positions.filter(p => getAssignment(p.id)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-app-text">School Prefects</h1>
          <p className="text-app-text-muted text-sm mt-0.5">Assign student prefects for each academic year</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-app-surface"
            >
              {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (Current)' : ''}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-app-text-muted pointer-events-none" />
          </div>
          {isAdmin && (
            <button onClick={() => { setEditingPos(null); setPosForm({ ...EMPTY_POS }); setShowAddPos(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm">
              <Plus className="w-4 h-4" /> Add Position
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Positions', value: positions.length,   color: 'bg-app-surface-alt',    text: 'text-app-text' },
          { label: 'Assigned',        value: assignedCount,      color: 'bg-emerald-50',  text: 'text-emerald-700' },
          { label: 'Vacant',          value: positions.length - assignedCount, color: 'bg-amber-50', text: 'text-amber-700' },
          { label: 'Categories',      value: Object.keys(grouped).length, color: 'bg-blue-50', text: 'text-blue-700' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-bold ${s.text}`}>{s.value}</p>
            <p className="text-xs text-app-text-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-app-text-muted">Loading prefect board...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, categoryPositions]) => (
            <div key={category}>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-app-text-muted uppercase tracking-wide mb-3">
                <Shield className="w-4 h-4" /> {category}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {categoryPositions.map(pos => {
                  const assignment = getAssignment(pos.id);
                  return (
                    <div key={pos.id} className={`bg-app-surface border rounded-xl overflow-hidden transition-shadow hover:shadow-md ${assignment ? 'border-emerald-200' : 'border-app-border border-dashed'}`}>
                      <div className={`h-1 ${assignment ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-app-text">
                              {pos.title} {GENDER_LABEL[pos.gender] && <span className="font-normal text-app-text-muted">({GENDER_LABEL[pos.gender]})</span>}
                            </h3>
                            {pos.gender !== 'any' && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GENDER_BADGE[pos.gender]}`}>
                                {pos.gender === 'boy' ? 'Male' : 'Female'}
                              </span>
                            )}
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <button onClick={() => { setEditingPos(pos); setPosForm({ title: pos.title, gender: pos.gender as any, category: pos.category, sort_order: pos.sort_order }); setShowAddPos(true); }}
                                className="p-1 text-slate-300 hover:text-app-text-muted rounded transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {assignment ? (
                          <div className="flex items-center gap-3">
                            <Initials name={assignment.student_name} avatarUrl={assignment.avatar_url} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-app-text text-sm truncate">{assignment.student_name}</p>
                              {assignment.appointed_date && (
                                <p className="text-xs text-app-text-muted">
                                  Appointed {new Date(assignment.appointed_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1">
                                <button onClick={() => { setAssigningPosition(pos); setShowAssignModal(true); }}
                                  className="p-1.5 text-app-text-muted hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Change">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => removeAssignment(assignment.id)}
                                  className="p-1.5 text-app-text-muted hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Remove">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-app-text-muted">
                              <User className="w-4 h-4" />
                              <span>Vacant</span>
                            </div>
                            {isAdmin && (
                              <button onClick={() => { setAssigningPosition(pos); setShowAssignModal(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-xs font-medium">
                                <Plus className="w-3.5 h-3.5" /> Assign
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Student Modal */}
      {showAssignModal && assigningPosition && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-app-surface rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-app-border">
              <h2 className="text-lg font-semibold text-app-text">
                Assign {assigningPosition.title}
                {GENDER_LABEL[assigningPosition.gender] ? ` (${GENDER_LABEL[assigningPosition.gender]})` : ''}
              </h2>
              <p className="text-sm text-app-text-muted mt-1">
                {years.find(y => y.id === selectedYear)?.name}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Appointment Date</label>
                <input type="date" value={appointedDate} onChange={e => setAppointedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Notes (optional)</label>
                <input type="text" value={assignNotes} onChange={e => setAssignNotes(e.target.value)}
                  placeholder="e.g. Appointed by principal"
                  className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Search Student</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-app-text-muted" />
                  <input
                    type="text"
                    placeholder="Type student name..."
                    value={studentSearch}
                    onChange={e => { setStudentSearch(e.target.value); searchStudents(e.target.value); }}
                    className="w-full pl-9 pr-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {studentResults.length > 0 && (
                  <div className="mt-2 border border-app-border rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                    {studentResults.map(s => (
                      <button key={s.id} onClick={() => assignStudent(s)} className="w-full text-left px-4 py-3 hover:bg-emerald-50 flex items-center gap-3 transition-colors border-b border-app-border last:border-0">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {s.first_name[0]}{s.last_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-app-text">{s.first_name} {s.last_name}</p>
                          {s.admission_number && <p className="text-xs text-app-text-muted">{s.admission_number}</p>}
                        </div>
                        <Star className="w-4 h-4 text-amber-400 ml-auto shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
                {studentSearch && studentResults.length === 0 && (
                  <p className="text-sm text-app-text-muted mt-2 text-center py-3 bg-app-surface-alt rounded-lg">No students found.</p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-app-border flex justify-end">
              <button onClick={() => { setShowAssignModal(false); setAssigningPosition(null); setStudentSearch(''); setStudentResults([]); setAssignNotes(''); }}
                className="px-4 py-2 text-app-text-muted hover:bg-app-surface-alt rounded-lg transition-colors text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Position Modal */}
      {showAddPos && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-app-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-app-text mb-5">{editingPos ? 'Edit Position' : 'Add New Position'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Title *</label>
                <input type="text" value={posForm.title} onChange={e => setPosForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Sports Prefect"
                  className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">Gender</label>
                  <select value={posForm.gender} onChange={e => setPosForm(p => ({ ...p, gender: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="boy">Boy</option>
                    <option value="girl">Girl</option>
                    <option value="any">Any</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">Sort Order</label>
                  <input type="number" value={posForm.sort_order} onChange={e => setPosForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Category</label>
                <input type="text" value={posForm.category} onChange={e => setPosForm(p => ({ ...p, category: e.target.value }))}
                  placeholder="e.g. Sports, Hostel, Chapel..."
                  className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowAddPos(false); setEditingPos(null); }} className="flex-1 px-4 py-2 border border-app-border rounded-lg text-app-text-muted hover:bg-app-surface-alt text-sm">Cancel</button>
              <button onClick={savePosition} disabled={savingPos || !posForm.title.trim()} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium">
                {savingPos ? 'Saving...' : editingPos ? 'Save' : 'Add Position'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
