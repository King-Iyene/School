import { useState, useEffect, useRef } from 'react';
import { Send, Mail, MailOpen, Plus, Search, Users, Megaphone, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Message {
  id: string;
  subject: string;
  body: string;
  broadcast: boolean;
  read: boolean;
  created_at: string;
  sender_id: string;
  recipient_id: string | null;
  sender: { first_name: string; last_name: string; role: string } | null;
  recipient: { first_name: string; last_name: string } | null;
}

interface Recipient { id: string; first_name: string; last_name: string; role: string; }

type Tab = 'inbox' | 'sent';

export default function Inbox() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [compose, setCompose] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [form, setForm] = useState({ recipient_id: '', subject: '', body: '', broadcast: false });
  const [sending, setSending] = useState(false);

  useEffect(() => { if (profile) { load(); loadRecipients(); } }, [profile, tab]);

  async function load() {
    setLoading(true);
    if (!profile) return;
    let q = supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(first_name, last_name, role), recipient:profiles!messages_recipient_id_fkey(first_name, last_name)')
      .eq('school_id', profile.school_id!)
      .order('created_at', { ascending: false });

    if (tab === 'inbox') {
      q = q.or(`recipient_id.eq.${profile.id},broadcast.eq.true`);
    } else {
      q = q.eq('sender_id', profile.id);
    }
    const { data } = await q;
    setMessages(data ?? []);
    setLoading(false);
  }

  async function loadRecipients() {
    if (!profile?.school_id) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('school_id', profile.school_id)
      .neq('id', profile.id)
      .order('first_name');
    setRecipients(data ?? []);
  }

  async function openMessage(msg: Message) {
    setSelected(msg);
    if (!msg.read && msg.recipient_id === profile?.id) {
      await supabase.from('messages').update({ read: true }).eq('id', msg.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
    }
  }

  async function sendMessage() {
    if (!form.subject.trim() || !form.body.trim() || (!form.broadcast && !form.recipient_id)) return;
    setSending(true);
    await supabase.from('messages').insert({
      school_id: profile!.school_id,
      sender_id: profile!.id,
      recipient_id: form.broadcast ? null : form.recipient_id,
      broadcast: form.broadcast,
      subject: form.subject,
      body: form.body,
    });
    setSending(false);
    setCompose(false);
    setForm({ recipient_id: '', subject: '', body: '', broadcast: false });
    load();
  }

  async function deleteMsg(id: string) {
    await supabase.from('messages').delete().eq('id', id);
    setMessages(prev => prev.filter(m => m.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  const filtered = messages.filter(m =>
    m.subject.toLowerCase().includes(search.toLowerCase()) ||
    `${m.sender?.first_name} ${m.sender?.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const unread = messages.filter(m => !m.read && m.recipient_id === profile?.id).length;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="p-6 border-b border-app-border flex items-center justify-between bg-app-surface">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Messages</h1>
          <p className="text-app-text-muted text-sm mt-0.5">{unread > 0 ? `${unread} unread` : 'All caught up'}</p>
        </div>
        <button onClick={() => setCompose(true)} className="flex items-center gap-2 px-4 py-2.5 bg-app-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-colors">
          <Plus className="w-4 h-4" /> Compose
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-app-border flex flex-col bg-app-surface">
          <div className="p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages..." className="bg-app-surface text-app-text w-full pl-9 pr-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-app-primary" />
            </div>
            <div className="flex gap-1">
              {(['inbox', 'sent'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`flex-1 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${tab === t ? 'bg-emerald-50 text-emerald-700' : 'text-app-text-muted hover:bg-app-surface-alt'}`}>
                  {t} {t === 'inbox' && unread > 0 && <span className="ml-1 bg-app-primary text-white rounded-full px-1.5 text-xs">{unread}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-20"><div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-app-text-muted">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No messages</p>
              </div>
            ) : (
              filtered.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => openMessage(msg)}
                  className={`w-full text-left p-3 border-b border-app-border hover:bg-app-surface-alt transition-colors ${selected?.id === msg.id ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {msg.broadcast ? (
                        <Megaphone className="w-4 h-4 text-amber-500" />
                      ) : !msg.read && tab === 'inbox' ? (
                        <Mail className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <MailOpen className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${!msg.read && tab === 'inbox' ? 'font-semibold text-app-text' : 'text-app-text'}`}>
                        {tab === 'inbox'
                          ? (msg.broadcast ? 'Broadcast' : `${msg.sender?.first_name} ${msg.sender?.last_name}`)
                          : (msg.broadcast ? 'Broadcast' : `${msg.recipient?.first_name} ${msg.recipient?.last_name}`)}
                      </p>
                      <p className={`text-xs truncate ${!msg.read && tab === 'inbox' ? 'text-app-text font-medium' : 'text-app-text-muted'}`}>{msg.subject}</p>
                      <p className="text-xs text-app-text-muted mt-0.5">{new Date(msg.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 bg-app-surface-alt overflow-y-auto">
          {selected ? (
            <div className="p-6 max-w-3xl">
              <div className="bg-app-surface rounded-2xl border border-app-border p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-app-text">{selected.subject}</h2>
                    <p className="text-sm text-app-text-muted mt-1">
                      From: <span className="font-medium text-app-text">{selected.sender?.first_name} {selected.sender?.last_name}</span>
                      <span className="ml-2 text-xs bg-slate-100 text-app-text-muted px-2 py-0.5 rounded-full capitalize">{selected.sender?.role?.replace('_', ' ')}</span>
                    </p>
                    {selected.recipient && (
                      <p className="text-sm text-app-text-muted">To: <span className="font-medium text-app-text">{selected.recipient.first_name} {selected.recipient.last_name}</span></p>
                    )}
                    {selected.broadcast && <p className="text-sm text-amber-600 font-medium">Broadcast to all</p>}
                    <p className="text-xs text-app-text-muted mt-1">{new Date(selected.created_at).toLocaleString()}</p>
                  </div>
                  <button onClick={() => deleteMsg(selected.id)} className="p-2 text-app-text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <hr className="border-app-border" />
                <p className="text-app-text text-sm leading-relaxed whitespace-pre-wrap">{selected.body}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-app-text-muted">
              <div className="text-center">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select a message to read</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={compose} onClose={() => setCompose(false)} title="New Message">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-app-surface-alt rounded-xl">
            <input type="checkbox" id="broadcast" checked={form.broadcast} onChange={e => setForm(f => ({ ...f, broadcast: e.target.checked, recipient_id: '' }))} className="w-4 h-4 accent-emerald-600" />
            <label htmlFor="broadcast" className="text-sm font-medium text-app-text flex items-center gap-1.5 cursor-pointer">
              <Megaphone className="w-4 h-4 text-amber-500" /> Send to everyone
            </label>
          </div>
          {!form.broadcast && (
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Recipient</label>
              <select value={form.recipient_id} onChange={e => setForm(f => ({ ...f, recipient_id: e.target.value }))} className="w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-primary bg-app-surface">
                <option value="">Select recipient...</option>
                {recipients.map(r => (
                  <option key={r.id} value={r.id}>{r.first_name} {r.last_name} ({r.role.replace('_', ' ')})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Subject</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="bg-app-surface text-app-text w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-primary" placeholder="Message subject..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Message</label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={5} className="bg-app-surface text-app-text w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-primary resize-none" placeholder="Write your message..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setCompose(false)} className="flex-1 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt">Cancel</button>
            <button
              onClick={sendMessage}
              disabled={sending || !form.subject.trim() || !form.body.trim() || (!form.broadcast && !form.recipient_id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-app-primary text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />{sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
