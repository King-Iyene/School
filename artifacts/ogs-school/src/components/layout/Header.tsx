import { useState, useEffect, useRef } from 'react';
import { Menu, Bell, Search, Globe, LayoutDashboard, BarChart2, User, KeyRound, LogOut, Check, ChevronDown, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { navigate } from '../hooks/useLocation';
import { usePushSubscription } from '../../hooks/usePushSubscription';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  notification_type?: string;
  is_read: boolean;
  created_at: string;
  metadata?: { url?: string } | null;
}

function getNotifRoute(n: Notification): string | null {
  if (n.metadata?.url) return n.metadata.url;
  const t = (n.title ?? '').toLowerCase();
  if (t.includes('requisition')) return '/hr/requisitions';
  if (t.includes('payroll') || t.includes('salary') || t.includes('leave')) return '/hr';
  if (t.includes('fee') || t.includes('payment') || t.includes('invoice')) return '/fees';
  if (t.includes('attendance')) return '/attendance';
  if (t.includes('assignment')) return '/assignments';
  if (t.includes('grade') || t.includes('score') || t.includes('result')) return '/grades';
  if (t.includes('announcement')) return '/notifications';
  if (t.includes('timetable') || t.includes('schedule')) return '/timetable';
  if (t.includes('library')) return '/library';
  if (t.includes('transport')) return '/transport';
  if (t.includes('inventory')) return '/inventory';
  return null;
}


export default function Header({ onMenuClick, title }: HeaderProps) {
  const { profile, signOut } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ title: string; message: string; url?: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Register for Web Push (service worker + VAPID). This handles permission & subscription storage.
  usePushSubscription(profile?.id);

  function showPush(title: string, message: string, url?: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ title, message, url });
    toastTimer.current = setTimeout(() => setToast(null), 6000);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/default-logo.png',
          badge: '/favicon.ico',
          tag: 'schoolos-notification',
        });
      } catch { }
    }
  }

  useEffect(() => {
    loadNotifications();

    if (!profile?.id) return;

    // Listen for new notifications in real-time
    const channel = supabase
      .channel(`header-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          loadNotifications();
          const n = payload.new as { title?: string; message?: string; metadata?: { url?: string } };
          if (n?.title) showPush(n.title, n.message ?? '', n.metadata?.url);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => { loadNotifications(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
        setShowChangePassword(false);
        setPwMsg('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function loadNotifications() {
    if (!profile?.id) return;
    let { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, type, notification_type, is_read, created_at, metadata')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error && (error.code === '42703' || error.message.includes('notification_type'))) {
      const fallback = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);
      data = fallback.data;
    }

    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  }

  async function markAllRead() {
    if (!profile?.id) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 6) { setPwMsg('Password must be at least 6 characters'); return; }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);
    if (error) { setPwMsg(error.message); } else { setPwMsg('Password updated successfully!'); setNewPassword(''); }
  }

  const initials = `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <header className="bg-white border-b border-slate-200 flex-shrink-0">
      {/* Push notification toast — fixed so it escapes the header's layout */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-[9999] flex items-start gap-3 bg-white border border-slate-200 shadow-xl rounded-2xl px-4 py-3.5 max-w-sm w-full"
          style={{ animation: 'slideInRight 0.3s ease' }}
        >
          <style>{`@keyframes slideInRight{from{opacity:0;transform:translateX(110%)}to{opacity:1;transform:translateX(0)}}`}</style>
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bell className="w-4 h-4 text-emerald-600" />
          </div>
          <div
            className={`flex-1 min-w-0 ${toast.url ? 'cursor-pointer' : ''}`}
            onClick={() => { if (toast.url) { setToast(null); navigate(toast.url); } }}
          >
            <p className="text-sm font-semibold text-slate-800 leading-tight">{toast.title}</p>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{toast.message}</p>
            {toast.url && <p className="text-xs text-emerald-600 font-medium mt-1">Tap to open →</p>}
          </div>
          <button onClick={() => setToast(null)} className="text-slate-300 hover:text-slate-500 flex-shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="h-14 flex items-center justify-between px-4 lg:px-6 gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold text-slate-800 lg:hidden truncate">{title}</h1>

          <div className="relative hidden sm:flex items-center max-w-xs w-full">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate('/dashboard')}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </button>
          <button
            onClick={() => navigate('/reports')}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Reports
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
            <Globe className="w-3.5 h-3.5" />
            <span>English</span>
            <ChevronDown className="w-3 h-3" />
          </div>

          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotifications(v => !v); setShowProfile(false); }}
              className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800 text-sm">Notifications</h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Mark all read
                      </button>
                    )}
                    <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400 text-sm">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No notifications
                    </div>
                  ) : notifications.map(n => {
                    const route = getNotifRoute(n);
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          markRead(n.id);
                          if (route) { setShowNotifications(false); navigate(route); }
                        }}
                        className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-emerald-50/50' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.is_read && <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />}
                          <div className={`flex-1 min-w-0 ${!n.is_read ? '' : 'pl-4'}`}>
                            <p className="text-sm font-medium text-slate-800 leading-tight">{n.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-slate-400">{new Date(n.created_at).toLocaleDateString()}</p>
                              {route && <span className="text-xs text-emerald-600 font-medium">→ Go to module</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
                  <button
                    onClick={() => { navigate('/notifications'); setShowNotifications(false); }}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium w-full text-center"
                  >
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setShowProfile(v => !v); setShowNotifications(false); }}
              className="flex items-center gap-2 p-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">
                {initials || <User className="w-4 h-4" />}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-slate-700 leading-tight">{profile?.first_name} {profile?.last_name}</p>
                <p className="text-[10px] text-slate-400 capitalize">{profile?.role?.replace('_', ' ')}</p>
              </div>
              <ChevronDown className="hidden md:block w-3 h-3 text-slate-400" />
            </button>

            {showProfile && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
                <div className="px-4 py-3 bg-emerald-600 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                      {initials}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{profile?.first_name} {profile?.last_name}</p>
                      <p className="text-xs text-emerald-100 capitalize">{profile?.role?.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      const role = profile?.role;
                      if (role === 'student') navigate('/student/profile');
                      else if (role === 'parent') navigate('/children');
                      else navigate(`/teacher-profile?id=${profile?.id}`);
                      setShowProfile(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    My Profile
                  </button>

                  <button
                    onClick={() => setShowChangePassword(v => !v)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <KeyRound className="w-4 h-4 text-slate-400" />
                    Change Password
                  </button>

                  {showChangePassword && (
                    <div className="px-4 pb-3">
                      <input
                        type="password"
                        placeholder="New password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
                      />
                      {pwMsg && <p className={`text-xs mb-2 ${pwMsg.includes('success') ? 'text-emerald-600' : 'text-red-500'}`}>{pwMsg}</p>}
                      <button
                        onClick={changePassword}
                        disabled={pwLoading}
                        className="w-full py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {pwLoading ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  )}

                  <div className="border-t border-slate-100 mt-1" />

                  <button
                    onClick={signOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
