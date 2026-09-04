import { useEffect, useState } from 'react';
import { LifeBuoy, Send, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT = 'bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30';

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

const STATUS_FILTERS = ['all', 'open', 'in_progress', 'resolved', 'closed'] as const;

interface Ticket {
  id: string;
  school_id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  schools?: { name: string } | { name: string }[] | null;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  author_id: string | null;
  is_platform_reply: boolean;
  message: string;
  created_at: string;
}

function schoolName(t: Ticket): string {
  const s = Array.isArray(t.schools) ? t.schools[0] : t.schools;
  return s?.name ?? 'Unknown School';
}

export default function SupportTicketsAdmin() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('all');
  const [selected, setSelected] = useState<Ticket | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('*, schools(name)')
      .order('updated_at', { ascending: false });
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  }

  const filtered = statusFilter === 'all' ? tickets : tickets.filter(t => t.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
              statusFilter === s
                ? 'bg-gradient-to-r from-brand-violet to-brand-indigo text-white shadow-sm'
                : 'bg-slate-100 text-app-text-muted hover:bg-slate-200'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-app-text-muted">Loading tickets...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <LifeBuoy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-app-text-muted font-medium">No tickets match this filter</p>
          </div>
        ) : (
          <div className="divide-y divide-app-border">
            {filtered.map(t => (
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
                    {schoolName(t)} · <Clock className="w-3 h-3" /> {new Date(t.updated_at).toLocaleString()}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize flex-shrink-0 ${STATUS_STYLES[t.status]}`}>
                  {t.status.replace('_', ' ')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <TicketDetailModal
          ticket={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { load(); }}
        />
      )}
    </div>
  );
}

function TicketDetailModal({ ticket, onClose, onChanged }: {
  ticket: Ticket; onClose: () => void; onChanged: () => void;
}) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
    if (!reply.trim() || !profile) return;
    setSending(true);
    await supabase.from('support_ticket_messages').insert({
      ticket_id: ticket.id,
      author_id: profile.id,
      is_platform_reply: true,
      message: reply.trim(),
    });
    setReply('');
    setSending(false);
    loadMessages();
    onChanged();
  }

  async function changeStatus(next: string) {
    setUpdatingStatus(true);
    await supabase.from('support_tickets').update({ status: next }).eq('id', ticket.id);
    setStatus(next);
    setUpdatingStatus(false);
    onChanged();
  }

  return (
    <Modal isOpen onClose={onClose} title={ticket.subject} size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_STYLES[ticket.priority]}`}>{ticket.priority}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-app-text-muted capitalize">{ticket.category.replace('_', ' ')}</span>
            <span className="text-xs text-app-text-muted">{schoolName(ticket)}</span>
          </div>
          <select
            value={status}
            onChange={e => changeStatus(e.target.value)}
            disabled={updatingStatus}
            className={`${INPUT} w-auto py-1.5 text-xs font-medium capitalize`}
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-app-text-muted py-4 text-center">Loading conversation...</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {messages.map(m => (
              <div key={m.id} className={`rounded-xl px-4 py-3 ${m.is_platform_reply ? 'bg-app-primary/10 border border-app-primary/20' : 'bg-app-surface-alt border border-app-border'}`}>
                <p className="text-xs font-semibold text-app-text-muted mb-1">{m.is_platform_reply ? 'Platform Support (you)' : schoolName(ticket)}</p>
                <p className="text-sm text-app-text whitespace-pre-wrap">{m.message}</p>
                <p className="text-[11px] text-app-text-muted mt-1">{new Date(m.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {status !== 'closed' && (
          <div className="flex gap-2 pt-2 border-t border-app-border">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              className={`${INPUT} resize-none flex-1`}
              rows={2}
              placeholder="Reply to this tenant..."
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
      </div>
    </Modal>
  );
}
