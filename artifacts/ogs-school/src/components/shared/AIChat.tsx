import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, CheckCircle2, XCircle, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../lib/apiUrl';

interface ProposedAction {
  id: string;
  type: string;
  summary: string;
  payload: Record<string, unknown>;
}

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  // Attached to an assistant message when the AI proposes a write action.
  action?: ProposedAction;
  // Tracks the outcome of an action card so it can't be resubmitted.
  actionState?: 'pending' | 'approving' | 'done' | 'dismissed' | 'error';
  actionResult?: string;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Title', content: 'Message', audience: 'Audience', is_pinned: 'Pinned',
  publish_date: 'Publish date', student_name: 'Student name', phone: 'Phone',
  email: 'Email', address: 'Address', source: 'Source', class_interested: 'Class of interest',
  description: 'Description', next_follow_up_date: 'Follow-up date', first_name: 'First name',
  last_name: 'Last name', class_applying_for: 'Class applying for', guardian_name: 'Guardian name',
  guardian_phone: 'Guardian phone', guardian_email: 'Guardian email', gender: 'Gender',
  date_of_birth: 'Date of birth', state_of_origin: 'State of origin', current_school: 'Current school',
  student_type: 'Student type', guardian_relationship: 'Relationship', guardian_occupation: 'Occupation',
  emergency_contact: 'Emergency contact', amount: 'Amount', date_needed: 'Date needed',
};

const SUGGESTIONS = [
  'How many students are active?',
  'Fee payments this month',
  'Most absent students this term',
  'Pending requisitions total',
];

// Minimal markdown-ish renderer: bold, headings, bullets, preserves tables as monospace
function renderContent(text: string) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const bolded = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : <span key={j}>{part}</span>
        );
        if (/^#{1,3} /.test(line)) {
          return <div key={i} className="font-bold text-app-text mt-2">{line.replace(/^#{1,3} /, '')}</div>;
        }
        if (/^[-*•] /.test(line)) {
          return <div key={i} className="pl-4 flex gap-2"><span>•</span><span>{line.slice(2)}</span></div>;
        }
        if (line.includes('|') && line.split('|').length > 2) {
          return <div key={i} className="font-mono text-xs whitespace-pre overflow-x-auto">{line}</div>;
        }
        return <div key={i}>{bolded}</div>;
      })}
    </div>
  );
}

interface AIChatProps {
  compact?: boolean;
  messages: Msg[];
  onMessagesChange: (msgs: Msg[]) => void;
}

export type { Msg };

export default function AIChat({ compact = false, messages, onMessagesChange }: AIChatProps) {
  const { profile } = useAuth();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setError('');
    setInput('');
    const next: Msg[] = [...messages, { role: 'user', content: question }];
    onMessagesChange(next);
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Your session has expired. Please log in again.');
        setBusy(false);
        return;
      }
      const resp = await fetch(apiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: next }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(data.error || 'The assistant could not answer. Please try again.');
      } else {
        const assistantMsg: Msg = { role: 'assistant', content: data.reply || '(no answer)' };
        if (data.proposedAction && typeof data.proposedAction.id === 'string') {
          assistantMsg.action = data.proposedAction as ProposedAction;
          assistantMsg.actionState = 'pending';
        }
        onMessagesChange([...next, assistantMsg]);
      }
    } catch {
      setError('Could not reach the assistant. Check your connection and try again.');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function patchMessage(index: number, patch: Partial<Msg>) {
    onMessagesChange(messages.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  async function approveAction(index: number) {
    const msg = messages[index];
    if (!msg?.action || msg.actionState !== 'pending') return;
    patchMessage(index, { actionState: 'approving' });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        patchMessage(index, { actionState: 'error', actionResult: 'Your session has expired. Please log in again.' });
        return;
      }
      const resp = await fetch(apiUrl('/api/ai/execute-action'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: msg.action.id,
          type: msg.action.type,
          payload: msg.action.payload,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        patchMessage(index, {
          actionState: 'error',
          actionResult: data.error || 'The action could not be completed. Please try again.',
        });
      } else {
        patchMessage(index, {
          actionState: 'done',
          actionResult: data.message || 'Done — the record was created.',
        });
      }
    } catch {
      patchMessage(index, { actionState: 'error', actionResult: 'Could not reach the assistant. Check your connection and try again.' });
    }
  }

  function dismissAction(index: number) {
    if (messages[index]?.actionState !== 'pending') return;
    patchMessage(index, { actionState: 'dismissed' });
  }

  function renderActionCard(msg: Msg, index: number) {
    const action = msg.action!;
    const entries = Object.entries(action.payload).filter(([, v]) => v !== undefined && v !== null && v !== '');
    return (
      <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-sm">
        <div className="flex items-center gap-1.5 font-semibold text-indigo-800 mb-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Action needs your approval
        </div>
        <p className="text-app-text mb-2">{action.summary}</p>
        <dl className="space-y-0.5 mb-3">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-xs">
              <dt className="text-app-text-muted min-w-[110px]">{FIELD_LABELS[k] ?? k}</dt>
              <dd className="text-app-text break-words">{String(v)}</dd>
            </div>
          ))}
        </dl>
        {msg.actionState === 'pending' && (
          <div className="flex gap-2">
            <button
              onClick={() => approveAction(index)}
              className="flex items-center gap-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg px-3 py-1.5 hover:bg-indigo-700 transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => dismissAction(index)}
              className="flex items-center gap-1.5 text-xs font-medium bg-app-surface text-app-text-muted border border-app-border rounded-lg px-3 py-1.5 hover:bg-app-surface-alt transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Dismiss
            </button>
          </div>
        )}
        {msg.actionState === 'approving' && (
          <div className="flex items-center gap-2 text-xs text-app-text-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…
          </div>
        )}
        {msg.actionState === 'done' && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> {msg.actionResult}
          </div>
        )}
        {msg.actionState === 'dismissed' && (
          <div className="text-xs text-app-text-muted">Dismissed.</div>
        )}
        {msg.actionState === 'error' && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <XCircle className="w-3.5 h-3.5" /> {msg.actionResult}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className={`flex-1 overflow-y-auto space-y-3 ${compact ? 'p-4' : 'rounded-2xl border border-app-border bg-app-surface p-4'}`}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <p className="text-app-text font-semibold mb-1">
              Hi{profile ? ` ${profile.first_name}` : ''} — ask about your school data
            </p>
            <p className="text-xs text-app-text-muted mb-4">Reads your school data; any actions need your approval.</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs bg-app-surface-alt text-app-text-muted border border-app-border rounded-full px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-md'
                : 'bg-app-surface-alt border border-app-border text-app-text rounded-bl-md'
            }`}>
              {m.role === 'assistant' ? renderContent(m.content) : m.content}
              {m.role === 'assistant' && m.action && renderActionCard(m, i)}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-app-surface-alt border border-app-border rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2 text-sm text-app-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking…
            </div>
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={`flex items-end gap-2 ${compact ? 'p-3 border-t border-app-border bg-app-surface' : 'mt-3'}`}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          rows={1}
          placeholder="Ask a question…"
          className="flex-1 resize-none bg-app-surface text-app-text border border-app-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 max-h-32"
        />
        <button
          onClick={() => send()}
          disabled={busy || !input.trim()}
          className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors"
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
