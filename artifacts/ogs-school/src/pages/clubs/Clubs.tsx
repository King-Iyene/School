import { useEffect, useState } from 'react';
import { Plus, Users, Calendar, MapPin, CreditCard as Edit2, Trash2, Eye, Award, FlaskConical, Mic, Wheat, Code2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../components/hooks/useLocation';

const CATEGORIES = ['All', 'STEM', 'Arts & Culture', 'Agriculture', 'Sports', 'Academic', 'Religious', 'Social', 'general'];

const CATEGORY_COLORS: Record<string, string> = {
  'STEM':          'bg-blue-100 text-blue-700',
  'Arts & Culture':'bg-rose-100 text-rose-700',
  'Agriculture':   'bg-green-100 text-green-700',
  'Sports':        'bg-orange-100 text-orange-700',
  'Academic':      'bg-cyan-100 text-cyan-700',
  'Religious':     'bg-amber-100 text-amber-700',
  'Social':        'bg-violet-100 text-violet-700',
  'general':       'bg-slate-100 text-app-text-muted',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'STEM':          Code2,
  'Arts & Culture': Mic,
  'Agriculture':   Wheat,
  'Sports':        Award,
  'Academic':      FlaskConical,
  'general':       Users,
};

function ClubIcon({ category }: { category: string }) {
  const Icon = CATEGORY_ICONS[category] ?? Users;
  return <Icon className="w-6 h-6" />;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Club {
  id: string;
  name: string;
  description: string | null;
  category: string;
  logo_url: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
  meeting_venue: string | null;
  is_active: boolean;
  member_count?: number;
  patrons?: string[];
}

const EMPTY_FORM = {
  name: '',
  description: '',
  category: 'general',
  meeting_day: '',
  meeting_time: '',
  meeting_venue: '',
  is_active: true,
};

export default function Clubs() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'teacher';
  const isAdmin = role === 'super_admin' || role === 'principal';

  const [clubs, setClubs] = useState<Club[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Club | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Club | null>(null);

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { if (selectedYear) loadClubs(); }, [selectedYear]);

  async function loadInitialData() {
    const { data: yData } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false });
    setYears(yData ?? []);
    setSelectedYear(yData?.find(y => y.is_current)?.id ?? yData?.[0]?.id ?? '');
  }

  async function loadClubs() {
    setLoading(true);
    const { data: clubsData } = await supabase
      .from('clubs')
      .select('*')
      .order('category')
      .order('name');

    if (!clubsData) { setLoading(false); return; }

    const enriched: Club[] = await Promise.all(
      clubsData.map(async (c) => {
        const [{ count }, { data: teachers }] = await Promise.all([
          supabase.from('club_members').select('id', { count: 'exact', head: true }).eq('club_id', c.id).eq('academic_year_id', selectedYear).eq('is_active', true),
          supabase.from('club_teachers').select('profiles(first_name, last_name)').eq('club_id', c.id),
        ]);
        const patrons = (teachers ?? []).map((t: any) => `${t.profiles?.first_name ?? ''} ${t.profiles?.last_name ?? ''}`.trim());
        return { ...c, member_count: count ?? 0, patrons };
      })
    );
    setClubs(enriched);
    setLoading(false);
  }

  const filtered = clubs.filter(c => {
    const catMatch = filterCat === 'All' || c.category === filterCat;
    const searchMatch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.description ?? '').toLowerCase().includes(search.toLowerCase());
    return catMatch && searchMatch;
  });

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  function openEdit(c: Club) {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description ?? '',
      category: c.category,
      meeting_day: c.meeting_day ?? '',
      meeting_time: c.meeting_time ?? '',
      meeting_venue: c.meeting_venue ?? '',
      is_active: c.is_active,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      meeting_day: form.meeting_day || null,
      meeting_time: form.meeting_time || null,
      meeting_venue: form.meeting_venue.trim() || null,
      is_active: form.is_active,
    };
    if (editing) {
      await supabase.from('clubs').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('clubs').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    loadClubs();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from('clubs').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    loadClubs();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app-text">School Clubs & Societies</h1>
          <p className="text-app-text-muted text-sm mt-0.5">Manage clubs, assign patrons and student members</p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-app-primary text-white rounded-lg hover:opacity-90 transition-colors">
            <Plus className="w-4 h-4" /> Add Club
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 space-y-3">
          <div className="flex gap-3">
            <div className="w-48">
              <label className="block text-[10px] font-bold text-app-text-muted uppercase mb-1">Academic Year</label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-app-primary bg-app-surface"
              >
                {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-app-text-muted uppercase mb-1">Search Clubs</label>
              <input
                type="text"
                placeholder="Search by name or description..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-app-surface text-app-text w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCat === cat ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-app-text-muted hover:bg-slate-200'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Clubs', value: clubs.length, color: 'bg-blue-50 text-blue-700', icon: Users },
          { label: 'Active Clubs', value: clubs.filter(c => c.is_active).length, color: 'bg-emerald-50 text-emerald-700', icon: Award },
          { label: 'Total Members', value: clubs.reduce((s, c) => s + (c.member_count ?? 0), 0), color: 'bg-amber-50 text-amber-700', icon: Users },
          { label: 'Categories', value: new Set(clubs.map(c => c.category)).size, color: 'bg-rose-50 text-rose-700', icon: Award },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color.split(' ')[0]} flex items-center gap-3`}>
            <s.icon className={`w-8 h-8 ${s.color.split(' ')[1]}`} />
            <div>
              <p className={`text-2xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</p>
              <p className="text-xs text-app-text-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Clubs Grid */}
      {loading ? (
        <div className="text-center py-12 text-app-text-muted">Loading clubs...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-app-text-muted">No clubs found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(club => (
            <div key={club.id} className={`bg-app-surface rounded-2xl border ${club.is_active ? 'border-app-border' : 'border-app-border opacity-60'} shadow-sm hover:shadow-md transition-shadow overflow-hidden`}>
              {/* Top stripe */}
              <div className={`h-1.5 ${club.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />

              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${CATEGORY_COLORS[club.category] ?? 'bg-slate-100 text-app-text-muted'}`}>
                      <ClubIcon category={club.category} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-app-text leading-tight">{club.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[club.category] ?? 'bg-slate-100 text-app-text-muted'}`}>
                        {club.category}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(club)} className="p-1.5 text-app-text-muted hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(club)} className="p-1.5 text-app-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {club.description && (
                  <p className="text-sm text-app-text-muted mb-4 line-clamp-2">{club.description}</p>
                )}

                <div className="space-y-1.5 mb-4">
                  {club.meeting_day && (
                    <div className="flex items-center gap-2 text-xs text-app-text-muted">
                      <Calendar className="w-3.5 h-3.5 text-app-text-muted" />
                      <span>{club.meeting_day}{club.meeting_time ? ` · ${club.meeting_time}` : ''}</span>
                    </div>
                  )}
                  {club.meeting_venue && (
                    <div className="flex items-center gap-2 text-xs text-app-text-muted">
                      <MapPin className="w-3.5 h-3.5 text-app-text-muted" />
                      <span>{club.meeting_venue}</span>
                    </div>
                  )}
                  {club.patrons && club.patrons.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-app-text-muted">
                      <Users className="w-3.5 h-3.5 text-app-text-muted" />
                      <span>Patron: {club.patrons.join(', ')}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-app-border">
                  <span className="text-sm font-semibold text-app-text">
                    {club.member_count} member{club.member_count !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => navigate(`/club-detail?id=${club.id}&year=${selectedYear}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-app-surface-alt text-app-text-muted rounded-lg hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-xs font-medium"
                  >
                    <Eye className="w-3.5 h-3.5" /> Manage
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-app-surface rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-app-border">
              <h2 className="text-lg font-semibold text-app-text">{editing ? 'Edit Club' : 'Add New Club'}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Club Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="bg-app-surface text-app-text w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
                  placeholder="e.g. Chess Club"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="bg-app-surface text-app-text w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-app-primary resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="bg-app-surface text-app-text w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">Meeting Day</label>
                  <select
                    value={form.meeting_day}
                    onChange={e => setForm(p => ({ ...p, meeting_day: e.target.value }))}
                    className="bg-app-surface text-app-text w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
                  >
                    <option value="">None</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">Meeting Time</label>
                  <input
                    type="time"
                    value={form.meeting_time}
                    onChange={e => setForm(p => ({ ...p, meeting_time: e.target.value }))}
                    className="bg-app-surface text-app-text w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">Venue</label>
                  <input
                    type="text"
                    value={form.meeting_venue}
                    onChange={e => setForm(p => ({ ...p, meeting_venue: e.target.value }))}
                    className="bg-app-surface text-app-text w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
                    placeholder="e.g. Science Lab"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-app-text">Active Club</span>
              </label>
            </div>
            <div className="p-6 border-t border-app-border flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-app-text-muted hover:bg-app-surface-alt rounded-lg transition-colors text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-5 py-2 bg-app-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors text-sm font-medium">
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Club'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-app-surface rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="font-semibold text-app-text mb-2">Delete Club?</h3>
            <p className="text-sm text-app-text-muted mb-6">This will permanently remove <strong>{deleteTarget.name}</strong> and all its members and assignments.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 border border-app-border rounded-lg text-app-text-muted hover:bg-app-surface-alt text-sm">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
