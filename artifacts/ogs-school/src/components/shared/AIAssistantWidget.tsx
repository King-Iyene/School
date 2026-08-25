import { useState } from 'react';
import { Sparkles, X, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AIChat, { Msg } from './AIChat';

const STAFF_ROLES = new Set([
  'super_admin', 'admin', 'principal', 'head_teacher', 'teacher',
  'nur_prim_teacher', 'accountant', 'security_officer', 'non_teaching_staff',
  'matron', 'porter', 'cleaner', 'admin_support', 'diocesan_official',
]);

/** Floating AI assistant button + slide-up chat panel, shown to staff on every page. */
export default function AIAssistantWidget() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);

  if (!profile || !STAFF_ROLES.has(profile.role)) return null;

  return (
    <>
      {/* Panel */}
      {open && (
        <div className="fixed z-50 bottom-20 right-4 sm:bottom-24 sm:right-6 w-[calc(100vw-2rem)] sm:w-[400px] h-[min(560px,calc(100vh-8rem))] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-purple-600">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-white" />
              <div>
                <p className="text-sm font-semibold text-white leading-tight">AI Assistant</p>
                <p className="text-[11px] text-indigo-100 leading-tight">Reads school data; actions need your approval</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="p-1.5 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg"
                  aria-label="Clear chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <AIChat compact messages={messages} onMessagesChange={setMessages} />
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed z-50 bottom-4 right-4 sm:bottom-6 sm:right-6 w-13 h-13 p-3.5 rounded-full shadow-lg transition-all ${
          open
            ? 'bg-slate-700 hover:bg-slate-800 shadow-slate-500/30'
            : 'bg-gradient-to-br from-indigo-600 to-purple-600 hover:scale-105 shadow-indigo-500/40'
        }`}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
      >
        {open ? <X className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-white" />}
      </button>
    </>
  );
}
