import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Bus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

interface Vehicle {
  id: string;
  vehicle_no: string;
  model: string;
  capacity: number;
  driver_name: string;
  driver_phone: string;
  route_id: string;
  is_active: boolean;
  transport_routes?: { route_name: string };
}

interface RouteOption {
  id: string;
  route_name: string;
}

export default function Vehicles() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    vehicle_no: '',
    model: '',
    capacity: '',
    driver_name: '',
    driver_phone: '',
    route_id: '',
    is_active: true,
  });

  useEffect(() => {
    fetchRoutes();
    fetchVehicles();
  }, []);

  async function fetchRoutes() {
    const { data } = await supabase
      .from('transport_routes')
      .select('id, route_name')
      .eq('is_active', true)
      .order('route_name');
    if (data) setRoutes(data as RouteOption[]);
  }

  async function fetchVehicles() {
    setLoading(true);
    const { data } = await supabase
      .from('transport_vehicles')
      .select('*, transport_routes(route_name)')
      .order('vehicle_no');
    if (data) setVehicles(data as Vehicle[]);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setForm({
      vehicle_no: '',
      model: '',
      capacity: '',
      driver_name: '',
      driver_phone: '',
      route_id: '',
      is_active: true,
    });
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(vehicle: Vehicle) {
    setEditId(vehicle.id);
    setForm({
      vehicle_no: vehicle.vehicle_no || '',
      model: vehicle.model || '',
      capacity: vehicle.capacity != null ? String(vehicle.capacity) : '',
      driver_name: vehicle.driver_name || '',
      driver_phone: vehicle.driver_phone || '',
      route_id: vehicle.route_id || '',
      is_active: vehicle.is_active ?? true,
    });
    setSaveError('');
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      vehicle_no: form.vehicle_no,
      model: form.model,
      capacity: form.capacity !== '' ? Number(form.capacity) : null,
      driver_name: form.driver_name,
      driver_phone: form.driver_phone,
      route_id: form.route_id || null,
      is_active: form.is_active,
    };
    let res;
    if (editId) {
      res = await supabase.from('transport_vehicles').update(payload).eq('id', editId);
    } else {
      res = await supabase.from('transport_vehicles').insert([payload]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchVehicles();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this vehicle?')) return;
    await supabase.from('transport_vehicles').delete().eq('id', id);
    fetchVehicles();
  }

  async function toggleActive(vehicle: Vehicle) {
    await supabase
      .from('transport_vehicles')
      .update({ is_active: !vehicle.is_active })
      .eq('id', vehicle.id);
    fetchVehicles();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-white p-2 rounded-xl">
            <Bus size={20} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Vehicles</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Vehicle
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : vehicles.length === 0 ? (
          <div className="p-12 text-center">
            <Bus size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No vehicles found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Vehicle No</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Model</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Capacity</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Driver</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Driver Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Route</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800">{v.vehicle_no}</td>
                    <td className="px-4 py-3 text-slate-600">{v.model || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{v.capacity ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{v.driver_name || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{v.driver_phone || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{v.transport_routes?.route_name || '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(v)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          v.is_active
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {v.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(v)}
                          className="text-slate-400 hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Vehicle' : 'Add Vehicle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle No</label>
              <input
                required
                className={INPUT_CLASS}
                value={form.vehicle_no}
                onChange={e => setForm(p => ({ ...p, vehicle_no: e.target.value }))}
                placeholder="e.g. LAG-001-XY"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
              <input
                className={INPUT_CLASS}
                value={form.model}
                onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
                placeholder="e.g. Toyota Hiace"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Capacity</label>
              <input
                type="number"
                min="1"
                className={INPUT_CLASS}
                value={form.capacity}
                onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))}
                placeholder="Seats"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Route</label>
              <select
                className={INPUT_CLASS}
                value={form.route_id}
                onChange={e => setForm(p => ({ ...p, route_id: e.target.value }))}
              >
                <option value="">Select Route</option>
                {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Driver Name</label>
              <input
                className={INPUT_CLASS}
                value={form.driver_name}
                onChange={e => setForm(p => ({ ...p, driver_name: e.target.value }))}
                placeholder="Driver full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Driver Phone</label>
              <input
                className={INPUT_CLASS}
                value={form.driver_phone}
                onChange={e => setForm(p => ({ ...p, driver_phone: e.target.value }))}
                placeholder="+234..."
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="vehicle_is_active"
              checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
              className="accent-emerald-500"
            />
            <label htmlFor="vehicle_is_active" className="text-sm text-slate-700">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
