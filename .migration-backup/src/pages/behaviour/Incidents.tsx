import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Plus, Pencil, Trash2, X, AlertTriangle, ShieldAlert, Shield } from 'lucide-react';

interface Incident {
  id: string;
  school_id: string;
  name: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major';
  points_deducted: number;
  created_at: string;
}

interface ModalState {
  open: boolean;
  mode: 'add' | 'edit';
  incident: Partial<Incident>;
}

const defaultForm: Partial<Incident> = {
  name: '',
  description: '',
  severity: 'minor',
  points_deducted: 0,
};

export default function Incidents() {
  const { profile } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add', incident: defaultForm });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchIncidents();
  }, []);

  async function fetchIncidents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('behaviour_incidents')
      .select('*')
      .eq('school_id', profile?.school_id || '')
      .order('created_at', { ascending: false });
    if (!error && data) setIncidents(data);
    setLoading(false);
  }

  function openAdd() {
    setModal({ open: true, mode: 'add', incident: { ...defaultForm } });
    setError('');
  }

  function openEdit(incident: Incident) {
    setModal({ open: true, mode: 'edit', incident: { ...incident } });
    setError('');
  }

  function closeModal() {
    setModal({ open: false, mode: 'add', incident: defaultForm });
    setError('');
  }

  function handleChange(field: keyof Incident, value: string | number) {
    setModal(prev => ({ ...prev, incident: { ...prev.incident, [field]: value } }));
  }

  async function handleSave() {
    const { name, description, severity, points_deducted } = modal.incident;
    if (!name || !severity) {
      setError('Name and severity are required.');
      return;
    }
    setSaving(true);
    setError('');
    if (modal.mode === 'add') {
      const { error: err } = await supabase.from('behaviour_incidents').insert({
        school_id: profile?.school_id || '',
        name,
        description,
        severity,
        points_deducted: points_deducted ?? 0,
      });
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('behaviour_incidents').update({
        name,
        description,
        severity,
        points_deducted: points_deducted ?? 0,
      }).eq('id', modal.incident.id);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    closeModal();
    fetchIncidents();
  }

  async function handleDelete(id: string) {
    await supabase.from('behaviour_incidents').delete().eq('id', id);
    setDeleteId(null);
    fetchIncidents();
  }

  function severityBadge(severity: string) {
    if (severity === 'minor') return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <Shield size={12} /> Minor
      </span>
    );
    if (severity === 'moderate') return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <AlertTriangle size={12} /> Moderate
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <ShieldAlert size={12} /> Major
      </span>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Behaviour Incident Types</h1>
          <p className="text-sm text-gray-500 mt-1">Manage the types of behaviour incidents for your school</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Add Incident Type
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ShieldAlert size={40} className="mb-3 text-gray-300" />
            <p className="text-base font-medium">No incident types defined</p>
            <p className="text-sm mt-1">Click "Add Incident Type" to get started</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Points Deducted</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {incidents.map(incident => (
                <tr key={incident.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{incident.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{incident.description || '—'}</td>
                  <td className="px-6 py-4">{severityBadge(incident.severity)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-medium">{incident.points_deducted}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(incident)}
                        className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteId(incident.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">
                {modal.mode === 'add' ? 'Add Incident Type' : 'Edit Incident Type'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={modal.incident.name || ''}
                  onChange={e => handleChange('name', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Classroom Disruption"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={modal.incident.description || ''}
                  onChange={e => handleChange('description', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Brief description of this incident type"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity <span className="text-red-500">*</span></label>
                <select
                  value={modal.incident.severity || 'minor'}
                  onChange={e => handleChange('severity', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="minor">Minor</option>
                  <option value="moderate">Moderate</option>
                  <option value="major">Major</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points Deducted</label>
                <input
                  type="number"
                  min={0}
                  value={modal.incident.points_deducted ?? 0}
                  onChange={e => handleChange('points_deducted', parseInt(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving...' : modal.mode === 'add' ? 'Add Incident' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800">Delete Incident Type</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this incident type? This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
