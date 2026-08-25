import { useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import AIChat, { Msg } from '../../components/shared/AIChat';

export default function AIAssistant() {
  const [messages, setMessages] = useState<Msg[]>([]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">AI Assistant</h1>
            <p className="text-xs text-slate-500">Answers from your school's live data; actions need your approval.</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear chat
          </button>
        )}
      </div>
      <AIChat messages={messages} onMessagesChange={setMessages} />
    </div>
  );
}
