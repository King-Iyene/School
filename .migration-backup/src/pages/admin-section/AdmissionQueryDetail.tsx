import { useEffect, useState } from 'react';
import { X, Phone, Mail, MapPin, BookOpen, Tag, Calendar, MessageSquare, Plus, Trash2, CreditCard as Edit2, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Query {
  id: string;
  student_name: string;
  phone?: string;
  email?: string;
  address?: string;
  source?: string;
  description?: string;
  note?: string;
  class_interested?: string;
  status: string;
  next_follow_up_date?: string;
  created_at: string;
  date?: string;
}

interface Props {
  query: Query | null;
  onClose: () => void;
  onEdit: (query: Query) => void;
  onDelete: (id: string) => void;
  onAddFollowUp: (queryId: string) => void;
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  follow_up: 'bg-blue-100 text-blue-700',
  converted: 'bg-teal-100 text-teal-700',
  closed: 'bg-slate-100 text-slate-600',
  inactive: 'bg-amber-100 text-amber-700',
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  follow_up: 'Follow Up',
  converted: 'Converted',
  closed: 'Closed',
  inactive: 'Inactive',
};

export default function AdmissionQueryDetail({ query, onClose, onEdit, onDelete, onAddFollowUp }: Props) {
  const { profile } = useAuth();
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query) loadFollowUps();
  }, [query?.id]);

  async function loadFollowUps() {
    if (!query) return;
    setLoading(true);
    const { data } = await supabase
      .from('admission_followups')
      .select('*')
      .eq('query_id', query.id)
      .order('follow_up_date', { ascending: false });
    setFollowUps(data ?? []);
    setLoading(false);
  }

  async function deleteFollowUp(id: string) {
    if (!confirm('Delete this follow-up?')) return;
    await supabase.from('admission_followups').delete().eq('id', id);
    loadFollowUps();
  }

  if (!query) return null;

  const queryDate = query.date
    ? new Date(query.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date(query.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{query.student_name}</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${statusColors[query.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {statusLabels[query.status] ?? query.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAddFollowUp(query.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Follow-up
            </button>
            <button
              onClick={() => onEdit(query)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {query.phone && (
                <InfoItem icon={<Phone className="w-4 h-4" />} label="Phone" value={query.phone} />
              )}
              {query.email && (
                <InfoItem icon={<Mail className="w-4 h-4" />} label="Email" value={query.email} />
              )}
              {query.address && (
                <InfoItem icon={<MapPin className="w-4 h-4" />} label="Address" value={query.address} />
              )}
              {query.source && (
                <InfoItem icon={<Tag className="w-4 h-4" />} label="Source" value={query.source} />
              )}
              {query.class_interested && (
                <InfoItem icon={<BookOpen className="w-4 h-4" />} label="Class Interested" value={query.class_interested} />
              )}
              <InfoItem icon={<Calendar className="w-4 h-4" />} label="Query Date" value={queryDate} />
              {query.next_follow_up_date && (
                <InfoItem
                  icon={<Clock className="w-4 h-4" />}
                  label="Next Follow-up"
                  value={new Date(query.next_follow_up_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  highlight
                />
              )}
            </div>

            {(query.description || query.note) && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes / Description</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{query.description || query.note}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Follow-up History</h3>
                <span className="text-xs text-slate-400">{followUps.length} record{followUps.length !== 1 ? 's' : ''}</span>
              </div>

              {loading ? (
                <p className="text-sm text-slate-400 py-4 text-center">Loading...</p>
              ) : followUps.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No follow-ups yet</p>
                  <button
                    onClick={() => onAddFollowUp(query.id)}
                    className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium"
                  >
                    Add the first follow-up
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
                  <div className="space-y-3">
                    {followUps.map((f, i) => (
                      <div key={f.id} className="relative pl-10">
                        <div className={`absolute left-2.5 top-2.5 w-3 h-3 rounded-full border-2 border-white ${i === 0 ? 'bg-blue-500' : 'bg-slate-300'}`} />
                        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-slate-800 leading-relaxed">{f.note}</p>
                            <button
                              onClick={() => deleteFollowUp(f.id)}
                              className="flex-shrink-0 p-1 text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                            <span>{new Date(f.follow_up_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            {f.next_follow_up_date && (
                              <span className="text-blue-500">Next: {new Date(f.next_follow_up_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={() => { if (confirm('Delete this query?')) { onDelete(query.id); onClose(); } }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete Query
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-slate-400">{icon}</span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className={`text-sm font-medium pl-6 ${highlight ? 'text-blue-600' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
