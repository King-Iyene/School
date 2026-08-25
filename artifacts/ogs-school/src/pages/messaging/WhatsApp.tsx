import { useState, useEffect } from 'react';
import { Send, Phone, MessageCircle, CheckCheck, Check, Clock, AlertCircle, RefreshCw, Search, Settings, Save, ToggleLeft, ToggleRight, Copy, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Log {
  id: string;
  phone: string;
  contact_name: string;
  message: string;
  direction: 'inbound' | 'outbound';
  status: string;
  created_at: string;
  sent_by: string | null;
  profiles: { first_name: string; last_name: string } | null;
}

interface Contact { id: string; first_name: string; last_name: string; phone: string; role: string; }

interface WASettings {
  phone_number_id: string;
  access_token: string;
  verify_token: string;
  enabled: boolean;
}

const SQL_SETUP = `-- Run once in your Supabase SQL editor
create table if not exists whatsapp_settings (
  school_id uuid primary key references schools(id) on delete cascade,
  phone_number_id text not null default '',
  access_token text not null default '',
  verify_token text not null default '',
  enabled boolean not null default false
);

create table if not exists whatsapp_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  phone text not null,
  contact_name text not null default '',
  message text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  status text not null default 'sent',
  sent_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table whatsapp_settings enable row level security;
alter table whatsapp_logs enable row level security;

create policy "wa_settings_school" on whatsapp_settings for all
  using (auth.uid() in (select id from profiles where school_id = whatsapp_settings.school_id and role in ('super_admin','admin','principal')));

create policy "wa_logs_school" on whatsapp_logs for all
  using (auth.uid() in (select id from profiles where school_id = whatsapp_logs.school_id));`;

const STATUS_ICON: Record<string, JSX.Element> = {
  sent: <Clock className="w-3.5 h-3.5 text-slate-400" />,
  delivered: <CheckCheck className="w-3.5 h-3.5 text-slate-400" />,
  read: <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />,
  failed: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
  received: <Check className="w-3.5 h-3.5 text-blue-400" />,
};

export default function WhatsApp() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [compose, setCompose] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [form, setForm] = useState({ phone: '', contact_name: '', message: '' });
  const [sending, setSending] = useState(false);
  const [waSettings, setWaSettings] = useState<WASettings>({ phone_number_id: '', access_token: '', verify_token: '', enabled: false });
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendError, setSendError] = useState('');
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  const sid = profile?.school_id;

  useEffect(() => { if (sid) { loadLogs(); loadContacts(); loadSettings(); } }, [sid]);

  async function loadLogs() {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_logs')
      .select('*, profiles!whatsapp_logs_sent_by_fkey(first_name, last_name)')
      .eq('school_id', sid!)
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs(data ?? []);
    setLoading(false);
  }

  async function loadContacts() {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, phone, role')
      .eq('school_id', sid!)
      .not('phone', 'is', null)
      .neq('phone', '')
      .order('first_name');
    setContacts(data ?? []);
  }

  async function loadSettings() {
    const { data, error } = await supabase
      .from('whatsapp_settings')
      .select('phone_number_id, access_token, verify_token, enabled')
      .eq('school_id', sid!)
      .maybeSingle();
    if (error?.code === '42P01') { setShowSql(true); return; }
    if (data) setWaSettings(data);
  }

  async function saveSettings() {
    setSavingSettings(true);
    await supabase.from('whatsapp_settings').upsert({ school_id: sid, ...waSettings }, { onConflict: 'school_id' });
    setSavingSettings(false);
    setSettingsOpen(false);
  }

  async function sendMsg() {
    if (!form.phone.trim() || !form.message.trim()) return;
    setSending(true);
    setSendError('');

    const phone = form.phone.replace(/\s+/g, '').replace(/^00/, '+');
    let status = 'log_only';

    try {
      if (isConfigured) {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${waSettings.phone_number_id}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${waSettings.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: phone,
              type: 'text',
              text: { body: form.message },
            }),
          }
        );
        const result = await res.json();
        if (!res.ok) {
          setSendError(result?.error?.message || 'WhatsApp API error. Check your credentials.');
          setSending(false);
          return;
        }
        status = 'sent';
      }

      await supabase.from('whatsapp_logs').insert({
        school_id: sid,
        phone: form.phone,
        contact_name: form.contact_name || form.phone,
        message: form.message,
        direction: 'outbound',
        status,
        sent_by: profile?.id,
      });

      setCompose(false);
      setForm({ phone: '', contact_name: '', message: '' });
      loadLogs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send. Please try again.';
      setSendError(msg);
    }
    setSending(false);
  }

  const filtered = logs.filter(l =>
    l.phone.includes(search) ||
    l.contact_name.toLowerCase().includes(search.toLowerCase()) ||
    l.message.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: logs.length,
    outbound: logs.filter(l => l.direction === 'outbound').length,
    inbound: logs.filter(l => l.direction === 'inbound').length,
    failed: logs.filter(l => l.status === 'failed').length,
  };

  const isConfigured = waSettings.enabled && waSettings.phone_number_id && waSettings.access_token;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">WhatsApp Channel</h1>
          <p className="text-slate-500 text-sm mt-1">Send and track WhatsApp messages to parents and students</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            <Settings className="w-4 h-4" /> API Settings
          </button>
          <button onClick={() => setCompose(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-xl text-sm font-medium hover:bg-[#20c05e] transition-colors">
            <MessageCircle className="w-4 h-4" /> New Message
          </button>
        </div>
      </div>

      {showSql && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Setup required — run this SQL in your Supabase editor first
          </p>
          <pre className="bg-amber-100 rounded-xl p-3 text-xs overflow-x-auto text-amber-900 whitespace-pre-wrap">{SQL_SETUP}</pre>
          <button onClick={() => { navigator.clipboard.writeText(SQL_SETUP); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900">
            {copied ? <><CheckCircle className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy SQL</>}
          </button>
        </div>
      )}

      {!isConfigured ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">WhatsApp Business API not connected</p>
            <p className="text-sm text-amber-700 mt-1">
              Connect your Meta WhatsApp Business account to send real messages. Messages are currently recorded in log-only mode.
            </p>
            <button onClick={() => setSettingsOpen(true)} className="mt-2 text-sm font-medium text-amber-700 underline">
              Configure API Settings
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex gap-4">
          <CheckCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-800">WhatsApp Business API connected</p>
            <p className="text-sm text-emerald-700 mt-1">Your channel is active. Messages will be delivered via the Meta Cloud API.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Messages', value: stats.total, color: 'text-slate-700 bg-slate-50' },
          { label: 'Sent', value: stats.outbound, color: 'text-blue-700 bg-blue-50' },
          { label: 'Received', value: stats.inbound, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Failed', value: stats.failed, color: 'text-red-700 bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm mt-0.5 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs..." className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <button onClick={loadLogs} className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No messages logged yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(log => (
              <div key={log.id} className={`flex items-start gap-4 p-4 hover:bg-slate-50 transition-colors ${log.direction === 'outbound' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${log.direction === 'inbound' ? 'bg-blue-100 text-blue-700' : 'bg-[#25D366]/10 text-[#25D366]'}`}>
                  {log.contact_name ? log.contact_name[0].toUpperCase() : <Phone className="w-4 h-4" />}
                </div>
                <div className={`flex-1 min-w-0 ${log.direction === 'outbound' ? 'text-right' : ''}`}>
                  <div className={`inline-block max-w-sm px-4 py-3 rounded-2xl text-sm ${log.direction === 'inbound' ? 'bg-slate-100 text-slate-800 rounded-tl-none' : 'bg-[#DCF8C6] text-slate-800 rounded-tr-none'}`}>
                    <p className="font-medium text-xs mb-1 text-slate-500">{log.contact_name || log.phone}</p>
                    <p className="whitespace-pre-wrap">{log.message}</p>
                    <div className={`flex items-center gap-1 mt-1.5 text-xs text-slate-400 ${log.direction === 'outbound' ? 'justify-end' : ''}`}>
                      <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {log.direction === 'outbound' && STATUS_ICON[log.status]}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="WhatsApp API Settings">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">How to connect Meta WhatsApp Business API</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
              <li>Create a Meta Developer account at developers.facebook.com</li>
              <li>Create a WhatsApp Business App and get a Phone Number ID</li>
              <li>Generate a Permanent Access Token from your app settings</li>
              <li>Enter the details below and enable the integration</li>
            </ol>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number ID</label>
            <input value={waSettings.phone_number_id} onChange={e => setWaSettings(s => ({ ...s, phone_number_id: e.target.value }))} placeholder="From Meta Developer Console" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Access Token</label>
            <input type="password" value={waSettings.access_token} onChange={e => setWaSettings(s => ({ ...s, access_token: e.target.value }))} placeholder="Meta Permanent Access Token" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Verify Token (optional)</label>
            <input value={waSettings.verify_token} onChange={e => setWaSettings(s => ({ ...s, verify_token: e.target.value }))} placeholder="For webhook verification" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Enable WhatsApp Integration</p>
              <p className="text-xs text-slate-500">Toggle to activate sending via the API</p>
            </div>
            <button onClick={() => setWaSettings(s => ({ ...s, enabled: !s.enabled }))}>
              {waSettings.enabled
                ? <ToggleRight className="w-8 h-8 text-emerald-500" />
                : <ToggleLeft className="w-8 h-8 text-slate-300" />}
            </button>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setSettingsOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button onClick={saveSettings} disabled={savingSettings} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={compose} onClose={() => { setCompose(false); setSendError(''); }} title="Send WhatsApp Message">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="+234 800 000 0000" />
            {contacts.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-slate-500 mb-1.5">Or choose from contacts:</p>
                <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2">
                  {contacts.slice(0, 10).map(c => (
                    <button
                      key={c.id}
                      onClick={() => setForm(f => ({ ...f, phone: c.phone, contact_name: `${c.first_name} ${c.last_name}` }))}
                      className="w-full text-left px-2 py-1.5 text-xs rounded-lg hover:bg-slate-50 transition-colors flex justify-between"
                    >
                      <span className="font-medium text-slate-700">{c.first_name} {c.last_name}</span>
                      <span className="text-slate-400">{c.phone}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name (optional)</label>
            <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Mr. John Smith" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={4} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" placeholder="Type your message..." />
          </div>
          {sendError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{sendError}</span>
            </div>
          )}
          {!isConfigured && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
              API not configured — message will be logged only and not delivered to the recipient.
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setCompose(false); setSendError(''); }} className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button
              onClick={sendMsg}
              disabled={sending || !form.phone.trim() || !form.message.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-xl text-sm font-medium hover:bg-[#20c05e] disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />{sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
