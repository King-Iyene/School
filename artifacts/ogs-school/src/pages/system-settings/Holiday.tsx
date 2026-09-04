import { useState, useEffect } from 'react';
import { CalendarDays, Plus, Pencil, Trash2, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

// All Nigerian federal public holidays for the 2025/2026 academic year (Sep 2025 – Jul 2026)
const NIGERIAN_HOLIDAYS_2025_2026 = [
  // ── Term 1 (Sep – Dec 2025) ─────────────────────────────────────────────────
  { name: "Mawlid al-Nabi",         holiday_date: '2025-09-04', end_date: '2025-09-05', holiday_type: 'Religious', description: "Prophet Muhammad's Birthday — Federal public holiday (moon-sighting dependent)" },
  { name: 'Independence Day',        holiday_date: '2025-10-01', end_date: null,         holiday_type: 'Public',    description: 'Nigeria National Day — Federal public holiday' },
  { name: 'Christmas Day',           holiday_date: '2025-12-25', end_date: null,         holiday_type: 'Public',    description: 'Christmas Day — Federal public holiday' },
  { name: 'Boxing Day',              holiday_date: '2025-12-26', end_date: null,         holiday_type: 'Public',    description: 'Boxing Day — Federal public holiday' },
  // ── Term 2 (Jan – Apr 2026) ─────────────────────────────────────────────────
  { name: "New Year's Day",          holiday_date: '2026-01-01', end_date: null,         holiday_type: 'Public',    description: "New Year's Day — Federal public holiday" },
  { name: 'Eid al-Fitr (Day 1)',     holiday_date: '2026-03-20', end_date: '2026-03-21', holiday_type: 'Religious', description: 'Eid el-Fitr — Federal public holiday (moon-sighting dependent)' },
  { name: 'Good Friday',             holiday_date: '2026-04-03', end_date: null,         holiday_type: 'Religious', description: 'Good Friday — Federal public holiday' },
  { name: 'Easter Monday',           holiday_date: '2026-04-06', end_date: null,         holiday_type: 'Religious', description: 'Easter Monday — Federal public holiday' },
  // ── Term 3 (Apr – Jul 2026) ─────────────────────────────────────────────────
  { name: "Workers' Day",            holiday_date: '2026-05-01', end_date: null,         holiday_type: 'Public',    description: 'International Labour Day — Federal public holiday' },
  { name: "Children's Day",          holiday_date: '2026-05-27', end_date: null,         holiday_type: 'Public',    description: "Children's Day — Federal public holiday" },
  { name: 'Eid al-Adha (Day 1)',     holiday_date: '2026-06-05', end_date: '2026-06-06', holiday_type: 'Religious', description: 'Eid el-Kabir — Federal public holiday (moon-sighting dependent)' },
  { name: 'Democracy Day',           holiday_date: '2026-06-12', end_date: null,         holiday_type: 'Public',    description: 'Nigeria Democracy Day — June 12 Federal holiday' },
];

interface AcademicYear {
  id: string;
  name: string;
}

interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  end_date: string | null;
  holiday_type: string;
  description: string | null;
  academic_year_id: string;
}

const INPUT_CLASS =
  'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

const EMPTY_FORM = {
  name: '',
  holiday_date: '',
  end_date: '',
  holiday_type: 'Public',
  description: '',
};

const TYPE_COLORS: Record<string, string> = {
  Public: 'bg-blue-100 text-blue-700',
  Religious: 'bg-purple-100 text-purple-700',
  School: 'bg-emerald-100 text-emerald-700',
  Other: 'bg-slate-100 text-app-text',
};

function daysBetween(start: string, end: string | null): number {
  if (!end) return 1;
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
}

export default function Holiday() {
  const { profile } = useAuth();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>('');
  const [error, setError] = useState('');

  async function fetchAcademicYears() {
    const { data } = await supabase
      .from('academic_years')
      .select('id, name')
      .eq('school_id', profile.school_id)
      .order('name', { ascending: false });
    if (data && data.length > 0) {
      setAcademicYears(data);
      setSelectedYear(data[0].id);
    }
  }

  async function fetchHolidays() {
    if (!selectedYear) return;
    setLoading(true);
    const { data } = await supabase
      .from('holiday_calendar')
      .select('*')
      .eq('academic_year_id', selectedYear)
      .order('holiday_date', { ascending: true });
    if (data) setHolidays(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchAcademicYears();
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [selectedYear]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError('');
    setModalOpen(true);
  }

  function openEdit(h: Holiday) {
    setForm({
      name: h.name,
      holiday_date: h.holiday_date,
      end_date: h.end_date || '',
      holiday_type: h.holiday_type,
      description: h.description || '',
    });
    setEditId(h.id);
    setError('');
    setModalOpen(true);
  }

  function openDelete(h: Holiday) {
    setDeleteTarget(h);
    setDeleteModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.holiday_date) {
      setError('Name and holiday date are required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      name: form.name,
      holiday_date: form.holiday_date,
      end_date: form.end_date || null,
      holiday_type: form.holiday_type,
      description: form.description || null,
      academic_year_id: selectedYear,
      school_id: profile.school_id,
    };
    if (editId) {
      const { error: err } = await supabase.from('holiday_calendar').update(payload).eq('id', editId);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('holiday_calendar').insert([payload]);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchHolidays();
  }

  async function handleQuickImport() {
    if (!selectedYear) return;
    setImporting(true);
    setImportResult('');
    // Avoid duplicates — fetch existing holidays by name for this year
    const { data: existing } = await supabase
      .from('holiday_calendar')
      .select('name, holiday_date')
      .eq('academic_year_id', selectedYear);
    const existingKeys = new Set((existing ?? []).map((h: any) => `${h.name}::${h.holiday_date}`));
    const toInsert = NIGERIAN_HOLIDAYS_2025_2026
      .filter(h => !existingKeys.has(`${h.name}::${h.holiday_date}`))
      .map(h => ({ ...h, academic_year_id: selectedYear, school_id: profile.school_id }));
    if (toInsert.length === 0) {
      setImportResult('All Nigerian 2025/2026 federal holidays already exist for this academic year.');
      setImporting(false);
      return;
    }
    const { error: err } = await supabase.from('holiday_calendar').insert(toInsert);
    if (err) {
      setImportResult(`Error: ${err.message}`);
    } else {
      setImportResult(`✓ Added ${toInsert.length} holiday${toInsert.length !== 1 ? 's' : ''} successfully.`);
      fetchHolidays();
    }
    setImporting(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    await supabase.from('holiday_calendar').delete().eq('id', deleteTarget.id);
    setSaving(false);
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    fetchHolidays();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-app-text">Holiday Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickImport}
            disabled={!selectedYear || importing}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
            title="Import all 12 Nigerian federal public holidays for the 2025/2026 academic year"
          >
            <Download className="w-4 h-4" />
            {importing ? 'Importing…' : 'Import 2025/2026 Federal Holidays'}
          </button>
          <button
            onClick={openCreate}
            disabled={!selectedYear}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            Add Holiday
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${importResult.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {importResult}
        </div>
      )}

      <div className="bg-app-surface rounded-2xl border border-app-border p-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-app-text-muted whitespace-nowrap">Academic Year</label>
          <select
            className={`${INPUT_CLASS} max-w-xs`}
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {academicYears.length === 0 && <option value="">No academic years found</option>}
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-app-text-muted text-sm">Loading holidays...</div>
        ) : holidays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-app-text-muted">
            <CalendarDays className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No holidays found for this academic year.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt text-app-text-muted text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Date Range</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Days</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {holidays.map((h) => (
                <tr key={h.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3 font-medium text-app-text">{h.name}</td>
                  <td className="px-4 py-3 text-app-text-muted">
                    {h.holiday_date}
                    {h.end_date && h.end_date !== h.holiday_date && (
                      <span className="text-app-text-muted"> — {h.end_date}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${TYPE_COLORS[h.holiday_type] || TYPE_COLORS.Other}`}>
                      {h.holiday_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-app-text-muted">
                    {daysBetween(h.holiday_date, h.end_date)} {daysBetween(h.holiday_date, h.end_date) === 1 ? 'day' : 'days'}
                  </td>
                  <td className="px-4 py-3 text-app-text-muted max-w-xs truncate">{h.description || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(h)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-xs px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => openDelete(h)}
                      className="text-red-500 hover:text-red-600 font-medium text-xs px-2 py-1 rounded-lg hover:bg-red-50 transition-colors inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Holiday' : 'Add Holiday'}>
        <div className="space-y-4">
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Holiday Name</label>
            <input
              className={INPUT_CLASS}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Christmas Day"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Start Date</label>
              <input
                type="date"
                className={INPUT_CLASS}
                value={form.holiday_date}
                onChange={(e) => setForm({ ...form, holiday_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">End Date (optional)</label>
              <input
                type="date"
                className={INPUT_CLASS}
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Holiday Type</label>
            <select
              className={INPUT_CLASS}
              value={form.holiday_type}
              onChange={(e) => setForm({ ...form, holiday_type: e.target.value })}
            >
              <option value="Public">Public</option>
              <option value="Religious">Religious</option>
              <option value="School">School</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Description</label>
            <textarea
              className={INPUT_CLASS}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 text-sm text-app-text-muted hover:text-app-text font-medium rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 text-sm bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Holiday">
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-app-text">{deleteTarget?.name}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2.5 text-sm text-app-text-muted hover:text-app-text font-medium rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-5 py-2.5 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
