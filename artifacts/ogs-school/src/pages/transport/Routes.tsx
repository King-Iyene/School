import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Route } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

interface TransportRoute {
  id: string;
  route_name: string;
  description: string;
  fare: number;
  is_active: boolean;
}

export default function Routes() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    route_name: '',
    description: '',
    fare: '',
    is_active: true,
  });

  useEffect(() => {
    fetchRoutes();
  }, []);

  async function fetchRoutes() {
    setLoading(true);
    const { data } = await supabase
      .from('transport_routes')
      .select('*')
      .order('route_name');
    if (data) setRoutes(data as TransportRoute[]);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setForm({ route_name: '', description: '', fare: '', is_active: true });
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(route: TransportRoute) {
    setEditId(route.id);
    setForm({
      route_name: route.route_name || '',
      description: route.description || '',
      fare: route.fare != null ? String(route.fare) : '',
      is_active: route.is_active ?? true,
    });
    setSaveError('');
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      route_name: form.route_name,
      description: form.description,
      fare: form.fare !== '' ? Number(form.fare) : null,
      is_active: form.is_active,
    };
    let res;
    if (editId) {
      res = await supabase.from('transport_routes').update(payload).eq('id', editId);
    } else {
      res = await supabase.from('transport_routes').insert([payload]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchRoutes();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this route?')) return;
    await supabase.from('transport_routes').delete().eq('id', id);
    fetchRoutes();
  }

  async function toggleActive(route: TransportRoute) {
    await supabase
      .from('transport_routes')
      .update({ is_active: !route.is_active })
      .eq('id', route.id);
    fetchRoutes();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-app-primary text-white p-2 rounded-xl">
            <Route size={20} />
          </div>
          <h1 className="text-2xl font-bold text-app-text">Transport Routes</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Route
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-app-text-muted">Loading...</div>
        ) : routes.length === 0 ? (
          <div className="p-12 text-center">
            <Route size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">No transport routes found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Route Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Description</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Fare</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {routes.map(route => (
                  <tr key={route.id} className="hover:bg-app-surface-alt/50">
                    <td className="px-4 py-3 font-medium text-app-text">{route.route_name}</td>
                    <td className="px-4 py-3 text-app-text-muted max-w-xs truncate">{route.description || '-'}</td>
                    <td className="px-4 py-3 text-app-text font-medium">
                      {route.fare != null ? `₦${Number(route.fare).toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(route)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          route.is_active
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-app-text-muted hover:bg-slate-200'
                        }`}
                      >
                        {route.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(route)}
                          className="text-app-text-muted hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(route.id)}
                          className="text-app-text-muted hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Route' : 'Add Route'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Route Name</label>
            <input
              required
              className={INPUT_CLASS}
              value={form.route_name}
              onChange={e => setForm(p => ({ ...p, route_name: e.target.value }))}
              placeholder="e.g. North Route"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Description</label>
            <textarea
              className={INPUT_CLASS}
              rows={3}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Route description and stops..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Fare (₦)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={INPUT_CLASS}
              value={form.fare}
              onChange={e => setForm(p => ({ ...p, fare: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active_route"
              checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
              className="accent-emerald-500"
            />
            <label htmlFor="is_active_route" className="text-sm text-app-text">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-app-border text-app-text-muted hover:bg-app-surface-alt"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-app-primary hover:opacity-90 text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
