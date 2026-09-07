import { useEffect, useState } from 'react';
import { Plus, LifeBuoy, Send, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT = 'bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30';

const CATEGORIES = [
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'general', label: 'General' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-100 text-app-text-muted',
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-app-text-muted',
  normal: 'bg-blue-50 text-blue-600',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

interface Ticket {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  author_id: string | null;
  is_platform_reply: boolean;
  message: string;
  created_at: string;
}

export default function SupportTickets() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);

  useEffect(() => { load(); }, [profile?.school_id]);

  async function load() {
    if (!profile?.school_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('updated_at', { ascending: false });
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">Support Tickets</h2>
          <p className="text-app-text-muted text-sm">Get help from the platform team with billing, technical, or feature questions</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-app-text-muted">Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center">
          <LifeBuoy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-app-text-muted font-medium">No support tickets yet</p>
          <p className="text-app-text-muted text-sm mt-1">Click "New Ticket" if you need help from the platform team</p>
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm divide-y divide-app-border">
          {tickets.map(t => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className="w-full text-left p-4 flex items-center gap-4 hover:bg-app-surface-alt transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-app-text">{t.subject}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                </div>
                <p className="text-xs text-app-text-muted mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Updated {new Date(t.updated_at).toLocaleString()}
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize flex-shrink-0 ${STATUS_STYLES[t.status]}`}>
                {t.status.replace('_', ' ')}
              </span>
            </button>
          ))}
        </div>
      )}

      {showNew && (
        <NewTicketModal
          schoolId={profile!.school_id!}
          userId={profile!.id}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(); }}
        />
      )}

      {selected && (
        <TicketDetailModal
          ticket={selected}
          currentUserId={profile!.id}
          onClose={() => setSelected(null)}
          onChanged={() => { load(); }}
        />
      )}
    </div>
  );
}

function NewTicketModal({ schoolId, userId, onClose, onCreated }: {
  schoolId: string; userId: string; onClose: () => void; onCreated: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!subject.trim() || !message.trim()) { setError('Subject and message are required.'); return; }
    setSaving(true);
    setError('');

    const { data: ticket, error: err } = await supabase
      .from('support_tickets')
      .insert({ school_id: schoolId, created_by: userId, subject: subject.trim(), category, priority })
      .select()
      .single();

    if (err || !ticket) { setError(err?.message ?? 'Could not create ticket.'); setSaving(false); return; }

    const { error: msgErr } = await supabase.from('support_ticket_messages').insert({
      ticket_id: ticket.id,
      author_id: userId,
      is_platform_reply: false,
      message: message.trim(),
    });

    setSaving(false);
    if (msgErr) { setError(msgErr.message); return; }
    onCreated();
  }

  return (
    <Modal isOpen onClose={onClose} title="New Support Ticket" size="lg">
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-app-text mb-1">Subject <span className="text-red-500">*</span></label>
          <input value={subject} onChange={e => setSubject(e.target.value)} className={INPUT} placeholder="Briefly describe the issue" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={`${INPUT} bg-app-surface`}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} className={`${INPUT} bg-app-surface`}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-app-text mb-1">Message <span className="text-red-500">*</span></label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            className={`${INPUT} resize-none`}
            rows={5}
            placeholder="Describe what's happening, what you expected, and any error messages you saw"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !subject.trim() || !message.trim()}
            className="flex-1 px-4 py-2.5 bg-app-primary hover:opacity-90 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TicketDetailModal({ ticket, currentUserId, onClose, onChanged }: {
  ticket: Ticket; currentUserId: string; onClose: () => void; onChanged: () => void;
}) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { loadMessages(); }, [ticket.id]);

  async function loadMessages() {
    setLoading(true);
    const { data } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at');
    setMessages((data ?? []) as TicketMessage[]);
    setLoading(false);
  }

  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    await supabase.from('support_ticket_messages').insert({
      ticket_id: ticket.id,
      author_id: currentUserId,
      is_platform_reply: false,
      message: reply.trim(),
    });
    setReply('');
    setSending(false);
    loadMessages();
    onChanged();
  }

  const closed = ticket.status === 'closed';

  return (
    <Modal isOpen onClose={onClose} title={ticket.subject} size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[ticket.status]}`}>{ticket.status.replace('_', ' ')}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_STYLES[ticket.priority]}`}>{ticket.priority}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-app-text-muted capitalize">{ticket.category.replace('_', ' ')}</span>
        </div>

        {loading ? (
          <p className="text-sm text-app-text-muted py-4 text-center">Loading conversation...</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {messages.map(m => (
              <div key={m.id} className={`rounded-xl px-4 py-3 ${m.is_platform_reply ? 'bg-app-primary/10 border border-app-primary/20' : 'bg-app-surface-alt border border-app-border'}`}>
                <p className="text-xs font-semibold text-app-text-muted mb-1">{m.is_platform_reply ? 'Platform Support' : 'You'}</p>
                <p className="text-sm text-app-text whitespace-pre-wrap">{m.message}</p>
                <p className="text-[11px] text-app-text-muted mt-1">{new Date(m.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {!closed && (
          <div className="flex gap-2 pt-2 border-t border-app-border">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              className={`${INPUT} resize-none flex-1`}
              rows={2}
              placeholder="Write a reply..."
            />
            <button
              onClick={sendReply}
              disabled={sending || !reply.trim()}
              className="px-4 bg-app-primary hover:opacity-90 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
        {closed && <p className="text-xs text-app-text-muted text-center pt-2 border-t border-app-border">This ticket is closed.</p>}
      </div>
    </Modal>
  );
}
