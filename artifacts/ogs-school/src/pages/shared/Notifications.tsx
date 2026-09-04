import { useEffect, useState, useRef } from 'react';
import {
  Trash2,
  ChevronLeft,
  ChevronRight,
  Bell,
  Users,
  Search,
  X,
  Inbox,
  Send as SendIcon,
  CheckCircle,
  Calendar,
  Paperclip,
  Building2,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type NotificationType = 'general' | 'assignment' | 'fee' | 'exam' | 'event' | 'alert' | 'individual';
type TargetType = 'all' | 'role' | 'class' | 'individual';
type RoleType = 'teacher' | 'student' | 'parent' | 'accountant';

interface SentNotification {
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

interface ProfileResult {
  id: string;
  full_name: string;
  email: string;
  role: string;
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
  general: 'bg-slate-100 text-app-text',
  assignment: 'bg-blue-100 text-blue-700',
  fee: 'bg-emerald-100 text-emerald-700',
  exam: 'bg-amber-100 text-amber-700',
  event: 'bg-teal-100 text-teal-700',
  alert: 'bg-red-100 text-red-700',
  individual: 'bg-indigo-100 text-indigo-700',
};

const PAGE_SIZE = 10;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Notifications() {
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [inboxNotifications, setInboxNotifications] = useState<SentNotification[]>([]);
  const [sentNotifications, setSentNotifications] = useState<SentNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [hasEnhancedSchema, setHasEnhancedSchema] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [inboxStats, setInboxStats] = useState({ total: 0, read: 0, unread: 0 });
  const [sentStats, setSentStats] = useState({ total: 0, read: 0, unread: 0 });

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [notifType, setNotifType] = useState<NotificationType>('general');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [targetRole, setTargetRole] = useState<RoleType>('student');
  const [targetClassId, setTargetClassId] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [attachments, setAttachments] = useState<{name: string, url: string, type: string}[]>([]);
  const [uploading, setUploading] = useState(false);
  const [individualQuery, setIndividualQuery] = useState('');
  const [individualResults, setIndividualResults] = useState<ProfileResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<ProfileResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [fetchError, setFetchError] = useState('');

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schoolId = profile?.school_id;
  const userId = profile?.id;

  const isStaff = ['super_admin', 'admin', 'principal', 'teacher', 'accountant'].includes(profile?.role || '');

  useEffect(() => {
    if (!userId) return;
    
    // Subscribe to changes
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          if (activeTab === 'inbox') fetchInbox();
          else fetchSent();
          fetchStats();
        }
      )
      .subscribe();

    if (activeTab === 'inbox') fetchInbox();
    else fetchSent();
    fetchStats();
    if (isStaff) fetchClasses();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, page, activeTab]);

  useEffect(() => {
    if (targetType !== 'individual') {
      setIndividualQuery('');
      setIndividualResults([]);
      setSelectedUser(null);
    } else if (notifType === 'general') {
      // Auto-switch to individual type if currently general
      setNotifType('individual');
    }
  }, [targetType]);

  useEffect(() => {
    if (!individualQuery.trim() || targetType !== 'individual') {
      setIndividualResults([]);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      searchProfiles(individualQuery.trim());
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [individualQuery, targetType]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    setSendError('');
    
    const newAttachments = [...attachments];
    
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setSendError(`File ${file.name} is too large (max 10MB)`);
        continue;
      }
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${schoolId}/${userId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('notification-attachments')
        .upload(filePath, file);
        
      if (uploadError) {
        setSendError(`Failed to upload ${file.name}`);
        continue;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('notification-attachments')
        .getPublicUrl(filePath);
        
      newAttachments.push({
        name: file.name,
        url: publicUrl,
        type: file.type
      });
    }
    
    setAttachments(newAttachments);
    setUploading(false);
  }

  async function searchProfiles(query: string) {
    setSearchLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role')
      .eq('school_id', schoolId)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      .limit(8);
    
    const mapped = (data ?? []).map(u => ({
      ...u,
      full_name: `${u.first_name} ${u.last_name}`
    }));
    
    setIndividualResults(mapped);
    setSearchLoading(false);
  }

  async function fetchInbox() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const now = new Date().toISOString();
    const ENHANCED_COLS = 'id,title,message,type,notification_type,target_type,target_role,target_class_id,scheduled_at,attachments,created_at,is_read';
    
    setFetchError('');
    
    let result: any = null;
    if (hasEnhancedSchema) {
      result = await supabase
        .from('notifications')
        .select(ENHANCED_COLS, { count: 'exact' })
        .eq('user_id', userId)
        .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
        .order('created_at', { ascending: false })
        .range(from, to);
    } else {
      result = { error: { code: '42703', message: 'Sticky Compatibility Mode' } };
    }

    if (result.error && (result.error.code === '42703' || result.error.message?.includes('target_class_id'))) {
      setHasEnhancedSchema(false);
      result = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);
      
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
    setInboxNotifications((result.data as SentNotification[]) ?? []);
    setTotalCount(result.count ?? 0);
    loadingRef.current = false;
    setLoading(false);
  }

  async function fetchSent() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const ENHANCED_COLS = 'id,title,message,type,notification_type,target_type,target_role,target_class_id,scheduled_at,attachments,created_at,is_read';
    
    setFetchError('');

    let result: any = null;
    if (hasEnhancedSchema) {
      result = await supabase
        .from('notifications')
        .select(ENHANCED_COLS, { count: 'exact' })
        .eq('sender_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);
    } else {
      result = { error: { code: '42703', message: 'Sticky Compatibility Mode' } };
    }

    if (result.error && (result.error.code === '42703' || result.error.message?.includes('target_class_id'))) {
      result = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('sender_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);
    }

    if (result.error) {
      console.error('Error fetching sent:', result.error);
      setFetchError(`Failed to load sent notifications: ${result.error.message}`);
      loadingRef.current = false;
      setLoading(false);
      return;
    }
    setSentNotifications((result.data as SentNotification[]) ?? []);
    setTotalCount(result.count ?? 0);
    loadingRef.current = false;
    setLoading(false);
  }

  async function fetchStats() {
    if (!userId) return;
    
    const countQuery = (isInbox: boolean, isRead?: boolean) => {
      let q = supabase.from('notifications').select('*', { count: 'exact', head: true });
      if (isInbox) q = q.eq('user_id', userId);
      else q = q.eq('sender_id', userId);
      if (isRead !== undefined) q = q.eq('is_read', isRead);
      return q;
    };

    try {
      const [total, read] = await Promise.all([
        countQuery(true),
        countQuery(true, true),
      ]);
      setInboxStats({ total: total.count ?? 0, read: read.count ?? 0, unread: (total.count ?? 0) - (read.count ?? 0) });
      
      const [sTotal, sRead] = await Promise.all([
        countQuery(false),
        countQuery(false, true),
      ]);
      setSentStats({ total: sTotal.count ?? 0, read: sRead.count ?? 0, unread: (sTotal.count ?? 0) - (sRead.count ?? 0) });
    } catch (e) {}
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (activeTab === 'inbox') {
      setInboxNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    }
    fetchStats();
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    setInboxNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    fetchStats();
  }

  async function fetchClasses() {
    const { data } = await supabase.from('classes').select('id, name, level, section').eq('school_id', schoolId).order('name');
    setClasses(data ?? []);
  }

  async function handleSend() {
    if (!title.trim() || !message.trim()) {
      setSendError('Title and message are required.');
      return;
    }
    if (targetType === 'individual' && !selectedUser) {
      setSendError('Please select a recipient.');
      return;
    }
    if (targetType === 'class' && !targetClassId) {
      setSendError('Please select a class.');
      return;
    }
    
    setSending(true);
    setSendError('');
    setSendSuccess('');

    try {
      let recipientIds: string[] = [];
      
      if (targetType === 'individual' && selectedUser) {
        recipientIds = [selectedUser.id];
      } else if (targetType === 'role') {
        const { data } = await supabase.from('profiles').select('id').eq('school_id', schoolId).eq('role', targetRole);
        recipientIds = data?.map(d => d.id) || [];
      } else if (targetType === 'class') {
        const { data } = await supabase.from('student_enrollments').select('student_id').eq('class_id', targetClassId).eq('status', 'active');
        recipientIds = data?.map(d => d.student_id) || [];
      } else {
        const { data } = await supabase.from('profiles').select('id').eq('school_id', schoolId);
        recipientIds = data?.map(d => d.id) || [];
      }

      if (recipientIds.length === 0) {
        throw new Error('No recipients found for the selected target.');
      }

      const { error } = await supabase.rpc('create_notification_bulk', {
        p_school_id: schoolId,
        p_sender_id: userId,
        p_recipient_ids: recipientIds,
        p_title: title.trim(),
        p_message: message.trim(),
        p_type: 'info',
        p_notification_type: notifType,
        p_target_type: targetType,
        p_target_role: targetType === 'role' ? targetRole : null,
        p_target_class_id: targetType === 'class' ? targetClassId : null,
        p_scheduled_at: scheduledAt || null,
        p_attachments: attachments,
        p_metadata: {}
      });

      if (error) throw error;

      setSendSuccess('Notification sent successfully.');
      setTitle('');
      setMessage('');
      setScheduledAt('');
      setAttachments([]);
      fetchSent();
      fetchStats();
    } catch (err: any) {
      setSendError(err.message || 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this notification? Permanent action.')) return;
    
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting notification:', error);
      alert(`Deletion Failed!\n\nThis is usually due to missing database permissions.\nPlease apply '20260404051500_fix_notifications_delete_policy.sql' in your Supabase SQL Editor to enable deletions.`);
      setFetchError(`Deletion failed: ${error.message}`);
      return;
    }

    if (activeTab === 'inbox') fetchInbox();
    else fetchSent();
    fetchStats();
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="p-6 bg-app-surface-alt min-h-screen space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Notifications</h1>
          <p className="text-sm text-app-text-muted mt-1">Stay updated with school activities and messages</p>
        </div>
        {activeTab === 'inbox' && inboxStats.unread > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
          >
            <CheckCircle size={16} />
            Mark all as read
          </button>
        )}
      </div>

      <div className="flex bg-app-surface p-1 rounded-xl shadow-sm border border-app-border w-fit">
        <button
          onClick={() => { setActiveTab('inbox'); setPage(1); }}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'inbox'
              ? 'bg-emerald-500 text-white shadow-md'
              : 'text-app-text-muted hover:bg-app-surface-alt'
          }`}
        >
          <Inbox size={16} />
          Inbox
          {inboxStats.unread > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'inbox' ? 'bg-app-surface text-emerald-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {inboxStats.unread}
            </span>
          )}
        </button>
        {isStaff && (
          <button
            onClick={() => { setActiveTab('sent'); setPage(1); }}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'sent'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'text-app-text-muted hover:bg-app-surface-alt'
            }`}
          >
            <SendIcon size={16} />
            Sent
          </button>
        )}
      </div>

      {fetchError && (
        <div className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${fetchError.includes('Advanced features') ? 'bg-amber-50 border border-amber-200 text-amber-600' : 'bg-red-50 border border-red-200 text-red-600'}`}>
          <X size={16} onClick={() => setFetchError('')} className="cursor-pointer" />
          <div className="flex flex-col">
            <span className="font-semibold">{fetchError.includes('Advanced features') ? 'Compatibility Mode Active' : 'Error'}</span>
            <span>{fetchError}</span>
          </div>
          <p className="ml-auto text-[10px] hidden sm:block">Update required</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {activeTab === 'inbox' ? (
          <>
            <div className="bg-app-surface rounded-xl shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Bell size={18} className="text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-app-text">{inboxStats.total}</div>
                <div className="text-xs text-app-text-muted">Total Received</div>
              </div>
            </div>
            <div className="bg-app-surface rounded-xl shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Bell size={18} className="text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-app-text">{inboxStats.read}</div>
                <div className="text-xs text-app-text-muted">Read</div>
              </div>
            </div>
            <div className="bg-app-surface rounded-xl shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Bell size={18} className="text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-app-text">{inboxStats.unread}</div>
                <div className="text-xs text-app-text-muted">Unread</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-app-surface rounded-xl shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Bell size={18} className="text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-app-text">{sentStats.total}</div>
                <div className="text-xs text-app-text-muted">Total Sent</div>
              </div>
            </div>
            <div className="bg-app-surface rounded-xl shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Bell size={18} className="text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-app-text">{sentStats.read}</div>
                <div className="text-xs text-app-text-muted">Read by Recipients</div>
              </div>
            </div>
            <div className="bg-app-surface rounded-xl shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Bell size={18} className="text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-app-text">{sentStats.unread}</div>
                <div className="text-xs text-app-text-muted">Unread by Recipients</div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {(activeTab === 'sent' && isStaff) && (
          <div className="lg:col-span-2 bg-app-surface rounded-xl shadow-sm p-6 self-start">
            <h2 className="text-base font-semibold text-app-text mb-5">Send Notification</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Notification title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Message *</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  placeholder="Notification message..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Notification Type</label>
                <select
                  value={notifType}
                  onChange={(e) => setNotifType(e.target.value as NotificationType)}
                  className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-app-surface"
                >
                  {(Object.keys(TYPE_LABELS) as NotificationType[]).map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <div className="mt-2">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE_CLASSES[notifType]}`}>
                    {TYPE_LABELS[notifType]}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-app-text mb-2">Target</label>
                <div className="flex flex-col gap-2">
                  {(['all', 'role', 'class', 'individual'] as TargetType[]).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="targetType"
                        value={t}
                        checked={targetType === t}
                        onChange={() => setTargetType(t)}
                        className="accent-emerald-500"
                      />
                      <span className="text-sm text-app-text">
                        {t === 'all' ? 'All Users' : t === 'role' ? 'By Role' : t === 'class' ? 'By Class' : 'Individual'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {targetType === 'role' && (
                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">Role</label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as RoleType)}
                    className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-app-surface"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="parent">Parent</option>
                    <option value="accountant">Accountant</option>
                  </select>
                </div>
              )}

              {targetType === 'class' && (
                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">Class</label>
                  <select
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-app-surface"
                  >
                    <option value="">Select a class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.level}{c.section})</option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'individual' && (
                <div className="relative">
                  <label className="block text-sm font-medium text-app-text mb-1">Search User</label>
                  {selectedUser ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-app-text">{selectedUser.full_name}</div>
                        <div className="text-xs text-app-text-muted">{selectedUser.role} · {selectedUser.email}</div>
                      </div>
                      <button
                        onClick={() => { setSelectedUser(null); setIndividualQuery(''); }}
                        className="text-app-text-muted hover:text-app-text"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
                        <input
                          type="text"
                          value={individualQuery}
                          onChange={(e) => setIndividualQuery(e.target.value)}
                          className="bg-app-surface text-app-text w-full border border-app-border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          placeholder="Type a name to search..."
                        />
                      </div>
                      {searchLoading && (
                        <div className="text-xs text-app-text-muted mt-1 px-1">Searching...</div>
                      )}
                      {!searchLoading && individualResults.length > 0 && (
                        <div className="absolute z-20 w-full bg-app-surface border border-app-border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                          {individualResults.map((u) => (
                            <button
                              onClick={() => { setSelectedUser(u); setIndividualQuery(''); setIndividualResults([]); }}
                              className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors"
                            >
                              <div className="text-sm font-medium text-app-text">{u.full_name}</div>
                              <div className="text-xs text-app-text-muted">{u.role} · {u.email}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      {!searchLoading && individualQuery.trim() && individualResults.length === 0 && (
                        <div className="text-xs text-app-text-muted mt-1 px-1">No users found.</div>
                      )}
                    </>
                  )}
                </div>
              )}

              {sendError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {sendError}
                </div>
              )}
              {sendSuccess && (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {sendSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-app-text mb-1">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-app-text-muted" />
                    Schedule for later (Optional)
                  </div>
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <p className="text-[10px] text-app-text-muted mt-1">Leave empty to send immediately</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-app-text mb-1">
                  <div className="flex items-center gap-2">
                    <Paperclip size={14} className="text-app-text-muted" />
                    Attachments (Optional)
                  </div>
                </label>
                <div className="bg-app-surface text-app-text mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-app-border border-dashed rounded-lg">
                  <div className="space-y-1 text-center">
                    <div className="flex text-sm text-app-text-muted">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-app-surface rounded-md font-medium text-emerald-600 hover:text-emerald-500">
                        <span>Upload files</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileUpload} disabled={uploading} />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-app-text-muted">PNG, JPG, PDF up to 10MB</p>
                  </div>
                </div>

                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-app-surface-alt p-2 rounded-lg border border-app-border">
                        <div className="flex items-center gap-2 truncate">
                          {file.type.includes('image') ? <ImageIcon size={14} className="text-blue-500" /> : <FileText size={14} className="text-emerald-500" />}
                          <span className="text-xs text-app-text-muted truncate">{file.name}</span>
                        </div>
                        <button onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} className="text-app-text-muted hover:text-red-500">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {uploading && <div className="mt-2 text-xs text-emerald-600 animate-pulse">Uploading...</div>}
              </div>

              <button
                onClick={handleSend}
                disabled={sending || uploading}
                className="w-full bg-app-primary text-white font-medium py-2 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
              >
                {sending ? 'Sending...' : (
                  <>
                    <SendIcon size={16} />
                    Send Notification
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className={`${(activeTab === 'sent' && isStaff) ? 'lg:col-span-3' : 'lg:col-span-5'} bg-app-surface rounded-xl shadow-sm p-6`}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-app-text">
              {activeTab === 'inbox' ? 'My Notifications' : 'Sent Notifications'}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-app-text-muted">
              <Users size={13} />
              {totalCount} total
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-app-text-muted text-center py-12">Loading notifications...</div>
          ) : (activeTab === 'inbox' ? inboxNotifications : sentNotifications).length === 0 ? (
            <div className="text-sm text-app-text-muted text-center py-12">
              {activeTab === 'inbox' ? 'No notifications yet.' : 'No notifications sent yet.'}
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
                      <th className="text-left py-2 px-3 text-app-text-muted font-medium hidden sm:table-cell">Target</th>
                      <th className="text-left py-2 px-3 text-app-text-muted font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeTab === 'inbox' ? inboxNotifications : sentNotifications).map((n) => (
                      <tr key={n.id} className="border-b border-gray-50 hover:bg-app-surface-alt transition-colors">
                        <td className="py-2 px-3 text-app-text-muted whitespace-nowrap text-xs">{formatDate(n.created_at)}</td>
                        <td className="py-2 px-3">
                          <div className="text-app-text font-medium max-w-48 truncate">{n.title}</div>
                          {activeTab === 'inbox' && !n.is_read && (
                            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider bg-emerald-50 px-1 rounded">New</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-app-text-muted hidden md:table-cell max-w-64 truncate">{n.message}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE_CLASSES[n.notification_type as NotificationType] ?? 'bg-slate-100 text-app-text'}`}>
                            {TYPE_LABELS[n.notification_type as NotificationType] ?? n.notification_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-app-text-muted hidden sm:table-cell text-xs whitespace-nowrap">
                          {activeTab === 'inbox' ? 'System' : (
                            <div className="flex flex-col">
                              <span>
                                {n.target_type === 'all' ? 'All Users' : 
                                 n.target_type === 'role' ? `Role: ${n.target_role}` : 
                                 n.target_type === 'class' ? 'Class' : 'Individual'}
                              </span>
                              {n.target_type === 'class' && n.target_class_id && (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                                  <Building2 size={10} />
                                  {classes.find(c => c.id === n.target_class_id)?.name || 'Class'}
                                </span>
                              )}
                              {n.scheduled_at && new Date(n.scheduled_at) > new Date() && (
                                <span className="flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                                  <Calendar size={10} />
                                  Scheduled: {formatDate(n.scheduled_at)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-col gap-1">
                            {n.attachments && n.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                {n.attachments.map((file, i) => (
                                  <a
                                    key={i}
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-[10px] text-app-text-muted transition-colors"
                                    title={file.name}
                                  >
                                    {file.type.includes('image') ? <ImageIcon size={10} /> : <FileText size={10} />}
                                    <span className="max-w-[80px] truncate">{file.name}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              {activeTab === 'inbox' && !n.is_read && (
                                <button
                                  onClick={() => markRead(n.id)}
                                  className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors"
                                  title="Mark read"
                                >
                                  <CheckCircle size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(n.id)}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
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
    </div>
  );
}
