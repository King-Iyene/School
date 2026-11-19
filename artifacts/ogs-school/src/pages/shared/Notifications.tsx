import { useEffect, useState, useRef } from 'react';
import {
  Trash2,
  ChevronLeft,
  ChevronRight,
  Bell,
  Users,
  X,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  Filter,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type NotificationType = 'general' | 'assignment' | 'fee' | 'exam' | 'event' | 'alert' | 'individual';
type InboxFilter = 'all' | 'read' | 'unread';

interface InboxNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  notification_type: NotificationType;
  target_type: string;
  target_role?: string;
  target_class_id?: string;
  scheduled_at?: string;
  attachments?: any[];
  created_at: string;
  is_read: boolean;
}

const TYPE_LABELS: Record<NotificationType, string> = {
  general: 'General',
  assignment: 'Assignment',
  fee: 'Fee',
  exam: 'Exam',
  event: 'Event',
  alert: 'Alert',
  individual: 'Individual',
};

const TYPE_BADGE_CLASSES: Record<NotificationType, string> = {
  general: 'bg-slate-100 text-app-text dark:bg-slate-800',
  assignment: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  fee: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  exam: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  event: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  alert: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  individual: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
};

const PAGE_SIZE = 10;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Notifications() {
  const { profile } = useAuth();

  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [hasEnhancedSchema, setHasEnhancedSchema] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [fetchError, setFetchError] = useState('');

  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');

  const [stats, setStats] = useState({ total: 0, read: 0, unread: 0 });

  const userId = profile?.id;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          fetchInbox();
          fetchStats();
        }
      )
      .subscribe();

    fetchInbox();
    fetchStats();

    return () => { supabase.removeChannel(channel); };
  }, [userId, page, inboxFilter, typeFilter]);

  async function fetchInbox() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const now = new Date().toISOString();
    const ENHANCED_COLS = 'id,title,message,type,notification_type,target_type,target_role,target_class_id,scheduled_at,attachments,created_at,is_read';

    setFetchError('');

    let query: any = null;
    if (hasEnhancedSchema) {
      query = supabase
        .from('notifications')
        .select(ENHANCED_COLS, { count: 'exact' })
        .eq('user_id', userId)
        .or(`scheduled_at.is.null,scheduled_at.lte.${now}`);

      if (inboxFilter === 'read') query = query.eq('is_read', true);
      else if (inboxFilter === 'unread') query = query.eq('is_read', false);

      if (typeFilter !== 'all') query = query.eq('notification_type', typeFilter);

      query = query.order('created_at', { ascending: false }).range(from, to);
    } else {
      query = { error: { code: '42703', message: 'Sticky Compatibility Mode' } };
    }

    let result = await query;

    if (result.error && (result.error.code === '42703' || result.error.message?.includes('target_class_id'))) {
      setHasEnhancedSchema(false);
      let fallback = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (inboxFilter === 'read') fallback = fallback.eq('is_read', true);
      else if (inboxFilter === 'unread') fallback = fallback.eq('is_read', false);

      result = await fallback.order('created_at', { ascending: false }).range(from, to);

      if (!result.error) {
        setFetchError('Advanced features (scheduling/attachments) are disabled. Please apply the latest database migrations.');
      }
    }

    if (result.error) {
      console.error('Error fetching inbox:', result.error);
      setFetchError(`Failed to load inbox: ${result.error.message}`);
      loadingRef.current = false;
      setLoading(false);
      return;
    }
    setNotifications((result.data as InboxNotification[]) ?? []);
    setTotalCount(result.count ?? 0);
    loadingRef.current = false;
    setLoading(false);
  }

  async function fetchStats() {
    if (!userId) return;

    const countQuery = (isRead?: boolean) => {
      let q = supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      if (isRead !== undefined) q = q.eq('is_read', isRead);
      return q;
    };

    try {
      const [total, read] = await Promise.all([countQuery(), countQuery(true)]);
      setStats({ total: total.count ?? 0, read: read.count ?? 0, unread: (total.count ?? 0) - (read.count ?? 0) });
    } catch (e) {}
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    fetchStats();
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    fetchStats();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this notification? Permanent action.')) return;

    const { error } = await supabase.from('notifications').delete().eq('id', id);

    if (error) {
      console.error('Error deleting notification:', error);
      alert(`Deletion Failed!\n\nThis is usually due to missing database permissions.\nPlease apply '20260404051500_fix_notifications_delete_policy.sql' in your Supabase SQL Editor to enable deletions.`);
      setFetchError(`Deletion failed: ${error.message}`);
      return;
    }

    fetchInbox();
    fetchStats();
  }

  function changeFilter(filter: InboxFilter) {
    setInboxFilter(filter);
    setPage(1);
  }

  function changeTypeFilter(type: NotificationType | 'all') {
    setTypeFilter(type);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="p-6 bg-app-surface-alt min-h-screen space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Notifications</h1>
          <p className="text-sm text-app-text-muted mt-1">Stay updated with school activities and messages</p>
        </div>
        {stats.unread > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 rounded-lg transition-colors"
          >
            <CheckCircle size={16} />
            Mark all as read
          </button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-app-surface rounded-xl shadow-sm p-4 flex items-center gap-3 border border-app-border">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <Bell size={18} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-app-text">{stats.total}</div>
            <div className="text-xs text-app-text-muted">Total</div>
          </div>
        </div>
        <div className="bg-app-surface rounded-xl shadow-sm p-4 flex items-center gap-3 border border-app-border">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <Bell size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-app-text">{stats.read}</div>
            <div className="text-xs text-app-text-muted">Read</div>
          </div>
        </div>
        <div className="bg-app-surface rounded-xl shadow-sm p-4 flex items-center gap-3 border border-app-border">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <Bell size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-app-text">{stats.unread}</div>
            <div className="text-xs text-app-text-muted">Unread</div>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${fetchError.includes('Advanced features') ? 'bg-amber-50 border border-amber-200 text-amber-600' : 'bg-red-50 border border-red-200 text-red-600'}`}>
          <X size={16} onClick={() => setFetchError('')} className="cursor-pointer" />
          <div className="flex flex-col">
            <span className="font-semibold">{fetchError.includes('Advanced features') ? 'Compatibility Mode Active' : 'Error'}</span>
            <span>{fetchError}</span>
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* All / Read / Unread pills */}
          <div className="flex bg-app-surface-alt p-1 rounded-lg">
            {(['all', 'read', 'unread'] as InboxFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => changeFilter(f)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  inboxFilter === f
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-app-text-muted hover:text-app-text'
                }`}
              >
                {f === 'all' ? 'All' : f === 'read' ? 'Read' : 'Unread'}
                {f === 'unread' && stats.unread > 0 && (
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    inboxFilter === 'unread' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                  }`}>
                    {stats.unread}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Type filter dropdown */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <Filter size={14} className="text-app-text-muted" />
            <select
              value={typeFilter}
              onChange={(e) => changeTypeFilter(e.target.value as NotificationType | 'all')}
              className="bg-app-surface text-app-text text-sm border border-app-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="all">All Types</option>
              {(Object.keys(TYPE_LABELS) as NotificationType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notification list */}
      <div className="bg-app-surface rounded-xl shadow-sm p-6 border border-app-border">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-app-text">
            {inboxFilter === 'all' ? 'All Notifications' : inboxFilter === 'read' ? 'Read Notifications' : 'Unread Notifications'}
            {typeFilter !== 'all' && ` — ${TYPE_LABELS[typeFilter]}`}
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-app-text-muted">
            <Users size={13} />
            {totalCount} total
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-app-text-muted text-center py-12">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="text-sm text-app-text-muted text-center py-12">
            {inboxFilter === 'unread' ? 'No unread notifications.' : inboxFilter === 'read' ? 'No read notifications.' : 'No notifications yet.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-app-border">
                    <th className="text-left py-2 px-3 text-app-text-muted font-medium whitespace-nowrap">Date</th>
                    <th className="text-left py-2 px-3 text-app-text-muted font-medium">Title</th>
                    <th className="text-left py-2 px-3 text-app-text-muted font-medium hidden md:table-cell">Message</th>
                    <th className="text-left py-2 px-3 text-app-text-muted font-medium whitespace-nowrap">Type</th>
                    <th className="text-left py-2 px-3 text-app-text-muted font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n.id} className="border-b border-app-border/50 last:border-0 hover:bg-app-surface-alt transition-colors">
                      <td className="py-2 px-3 text-app-text-muted whitespace-nowrap text-xs">{formatDate(n.created_at)}</td>
                      <td className="py-2 px-3">
                        <div className="text-app-text font-medium max-w-48 truncate">{n.title}</div>
                        {!n.is_read && (
                          <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-900/30 px-1 rounded">New</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-app-text-muted hidden md:table-cell max-w-64 truncate">{n.message}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE_CLASSES[n.notification_type as NotificationType] ?? 'bg-slate-100 text-app-text'}`}>
                          {TYPE_LABELS[n.notification_type as NotificationType] ?? n.notification_type}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          {n.attachments && n.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {n.attachments.map((file: any, i: number) => (
                                <a
                                  key={i}
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-1.5 py-0.5 bg-app-surface-alt hover:bg-app-border rounded text-[10px] text-app-text-muted transition-colors"
                                  title={file.name}
                                >
                                  {file.type.includes('image') ? <ImageIcon size={10} /> : <FileText size={10} />}
                                  <span className="max-w-[80px] truncate">{file.name}</span>
                                </a>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            {!n.is_read && (
                              <button
                                onClick={() => markRead(n.id)}
                                className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                title="Mark read"
                              >
                                <CheckCircle size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(n.id)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-app-border">
                <div className="text-xs text-app-text-muted">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-app-border hover:bg-app-surface-alt transition-colors disabled:opacity-40"
                  >
                    <ChevronLeft size={14} className="text-app-text-muted" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-7 h-7 text-xs rounded-lg border transition-colors ${
                          page === pageNum
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'border-app-border text-app-text-muted hover:bg-app-surface-alt'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-app-border hover:bg-app-surface-alt transition-colors disabled:opacity-40"
                  >
                    <ChevronRight size={14} className="text-app-text-muted" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
