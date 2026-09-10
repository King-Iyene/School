import { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, RefreshCw, Copy, Check, History, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { apiUrl } from '../../lib/apiUrl';
import Modal from '../../components/common/Modal';

interface TenantWebhook {
  id: string;
  url: string;
  description: string;
  events: string[];
  is_active: boolean;
  secret: string;
  created_at: string;
}

interface Delivery {
  id: string;
  event_type: string;
  attempt: number;
  response_status: number | null;
  response_body: string;
  success: boolean;
  created_at: string;
}

const EVENT_TYPES = [
  { value: 'online_exam.graded', label: 'Online exam graded' },
  { value: 'fee.payment.recorded', label: 'Fee payment recorded' },
  { value: 'student.admitted', label: 'Student admitted' },
];

const inputClass = 'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

async function authedFetch(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers, Authorization: `Bearer ${session?.access_token ?? ''}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
}

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<TenantWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ url: '', description: '', events: [] as string[] });

  const [revealSecret, setRevealSecret] = useState<{ url: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [deliveriesFor, setDeliveriesFor] = useState<TenantWebhook | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState('');

  useEffect(() => { fetchWebhooks(); }, []);

  async function dispatchNow() {
    setDispatching(true);
    setDispatchResult('');
    try {
      const res = await authedFetch('/api/webhooks/dispatch-now', { method: 'POST' });
      setDispatchResult(
        res.processed === 0
          ? 'No pending events waiting.'
          : `Processed ${res.processed} event${res.processed !== 1 ? 's' : ''}, delivered to ${res.delivered} subscriber${res.delivered !== 1 ? 's' : ''}.`,
      );
    } catch (e: any) {
      setDispatchResult(e.message);
    } finally {
      setDispatching(false);
      setTimeout(() => setDispatchResult(''), 6000);
    }
  }

  async function fetchWebhooks() {
    setLoading(true);
    setError('');
    try {
      const res = await authedFetch('/api/webhooks');
      setWebhooks(res.webhooks ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm({ url: '', description: '', events: [] });
    setModalOpen(true);
  }

  function openEdit(w: TenantWebhook) {
    setEditingId(w.id);
    setForm({ url: w.url, description: w.description, events: w.events });
    setModalOpen(true);
  }

  function toggleEvent(value: string) {
    setForm(f => ({ ...f, events: f.events.includes(value) ? f.events.filter(e => e !== value) : [...f.events, value] }));
  }

  async function handleSave() {
    if (!form.url) { setError('A webhook URL is required.'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await authedFetch(`/api/webhooks/${editingId}`, { method: 'PATCH', body: JSON.stringify(form) });
      } else {
        const res = await authedFetch('/api/webhooks', { method: 'POST', body: JSON.stringify(form) });
        setRevealSecret({ url: res.webhook.url, secret: res.webhook.secret });
      }
      setModalOpen(false);
      fetchWebhooks();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(w: TenantWebhook) {
    await authedFetch(`/api/webhooks/${w.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !w.is_active }) });
    fetchWebhooks();
  }

  async function regenerateSecret(w: TenantWebhook) {
    const res = await authedFetch(`/api/webhooks/${w.id}/regenerate-secret`, { method: 'POST' });
    setRevealSecret({ url: w.url, secret: res.secret });
  }

  async function deleteWebhook(id: string) {
    await authedFetch(`/api/webhooks/${id}`, { method: 'DELETE' });
    fetchWebhooks();
  }

  async function openDeliveries(w: TenantWebhook) {
    setDeliveriesFor(w);
    setDeliveriesLoading(true);
    try {
      const res = await authedFetch(`/api/webhooks/${w.id}/deliveries`);
      setDeliveries(res.deliveries ?? []);
    } finally {
      setDeliveriesLoading(false);
    }
  }

  async function retryDelivery(deliveryId: string) {
    await authedFetch(`/api/webhooks/deliveries/${deliveryId}/retry`, { method: 'POST' });
    if (deliveriesFor) openDeliveries(deliveriesFor);
  }

  function copySecret(secret: string) {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Webhook className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-app-text">Webhooks</h1>
            <p className="text-sm text-app-text-muted mt-0.5">Notify your own systems when things happen in this school's account</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={dispatchNow}
            disabled={dispatching}
            title="Deliver any pending events immediately instead of waiting for the next scheduled run"
            className="flex items-center gap-2 border border-app-border text-app-text text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-app-surface-alt transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${dispatching ? 'animate-spin' : ''}`} /> {dispatching ? 'Sending...' : 'Send Pending Now'}
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> New Webhook
          </button>
        </div>
      </div>

      {dispatchResult && <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-xl px-4 py-3">{dispatchResult}</div>}
      {error && !modalOpen && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : webhooks.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center">
          <Webhook className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-app-text-muted">No webhooks configured yet.</p>
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Endpoint</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Events</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Secret</th>
                <th className="text-center px-4 py-3 font-semibold text-app-text-muted">Active</th>
                <th className="text-right px-4 py-3 font-semibold text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {webhooks.map(w => (
                <tr key={w.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-app-text truncate max-w-xs">{w.url}</p>
                    {w.description && <p className="text-xs text-app-text-muted">{w.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {w.events.map(e => (
                        <span key={e} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{e}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-app-text-muted">{w.secret}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(w)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${w.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-app-text-muted'}`}
                    >
                      {w.is_active ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openDeliveries(w)} title="Delivery log" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"><History size={15} /></button>
                      <button onClick={() => regenerateSecret(w)} title="Regenerate secret" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"><RefreshCw size={15} /></button>
                      <button onClick={() => openEdit(w)} title="Edit" className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"><Pencil size={15} /></button>
                      <button onClick={() => deleteWebhook(w.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Webhook' : 'New Webhook'} size="lg">
        <div className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Endpoint URL <span className="text-red-500">*</span></label>
            <input className={inputClass} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/webhooks/school" />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Description</label>
            <input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Our Zapier integration" />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-2">Events to send</label>
            <div className="space-y-2">
              {EVENT_TYPES.map(evt => (
                <label key={evt.value} className="flex items-center gap-2 text-sm text-app-text">
                  <input type="checkbox" checked={form.events.includes(evt.value)} onChange={() => toggleEvent(evt.value)} />
                  {evt.label}
                  <span className="text-xs text-app-text-muted font-mono">{evt.value}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-xl border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.url} className="px-4 py-2 text-sm rounded-xl bg-app-primary hover:opacity-90 text-white font-medium transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!revealSecret} onClose={() => setRevealSecret(null)} title="Webhook Signing Secret">
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">
            Save this secret now — it won't be shown again. Use it to verify the <code className="text-xs bg-app-surface-alt px-1 py-0.5 rounded">X-Webhook-Signature</code> header
            (HMAC-SHA256 of the raw request body) on every delivery to <span className="font-medium text-app-text">{revealSecret?.url}</span>.
          </p>
          <div className="flex items-center gap-2 bg-app-surface-alt border border-app-border rounded-xl px-3 py-2.5">
            <code className="text-xs flex-1 break-all">{revealSecret?.secret}</code>
            <button onClick={() => revealSecret && copySecret(revealSecret.secret)} className="text-app-text-muted hover:text-app-text">
              {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
            </button>
          </div>
          <div className="flex justify-end">
            <button onClick={() => setRevealSecret(null)} className="px-4 py-2 text-sm rounded-xl bg-app-primary hover:opacity-90 text-white font-medium transition-colors">Done</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deliveriesFor} onClose={() => setDeliveriesFor(null)} title="Delivery Log" size="xl">
        {deliveriesLoading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-app-text-muted text-center py-8">No deliveries yet.</p>
        ) : (
          <div className="space-y-2">
            {deliveries.map(d => (
              <div key={d.id} className="border border-app-border rounded-xl p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-app-text">{d.event_type}</p>
                  <p className="text-xs text-app-text-muted">{new Date(d.created_at).toLocaleString()} · attempt {d.attempt} · {d.response_status ?? 'no response'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {d.success ? 'Delivered' : 'Failed'}
                  </span>
                  {!d.success && (
                    <button onClick={() => retryDelivery(d.id)} className="text-xs font-medium text-app-primary hover:underline">Retry</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
