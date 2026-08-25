import { useState, useEffect } from 'react';
import { NavLink } from '../common/NavLink';
import { useAuth } from '../../context/AuthContext';
import { LogOut, X, ChevronDown, ChevronRight } from 'lucide-react';
import { getNavItems } from './navConfig';
import { navigate } from '../hooks/useLocation';
import { supabase } from '../../lib/supabase';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const navItems = getNavItems(profile?.role);
  const groupedMapInit = navItems.filter(i => i.group).reduce((acc, item) => { acc[item.group!] = true; return acc; }, {} as Record<string, boolean>);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set(Object.keys(groupedMapInit)));
  const [schoolName, setSchoolName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (!profile?.school_id) return;
    supabase.from('schools').select('name, logo_url').eq('id', profile.school_id).maybeSingle().then(({ data }) => {
      if (data) {
        setSchoolName(data.name ?? '');
        setLogoUrl(data.logo_url ?? '');
      }
    });
  }, [profile?.school_id]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.logo_url !== undefined) setLogoUrl(detail.logo_url);
    };
    window.addEventListener('school-logo-updated', handler);
    return () => window.removeEventListener('school-logo-updated', handler);
  }, []);

  const ungrouped = navItems.filter(i => !i.group);
  const groupedMap = navItems.filter(i => i.group).reduce((acc, item) => {
    const g = item.group!;
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  const groups = Object.keys(groupedMap);

  function toggleGroup(group: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  }

  const displayName = schoolName || 'School';
  const nameParts = displayName.split(' ');
  const firstName = nameParts[0] ?? 'School';
  const restName = nameParts.slice(1).join(' ');

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-slate-900 border-r border-slate-800
        flex flex-col transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden bg-white flex items-center justify-center">
              <img
                src={logoUrl || '/ogs_logo_bg.png'}
                alt="School logo"
                className="w-full h-full object-contain p-0.5"
              />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-bold leading-tight truncate">{firstName}</p>
              {restName && <p className="text-slate-400 text-xs truncate">{restName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white flex-shrink-0 ml-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <span className="text-white text-sm font-semibold">
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {profile?.first_name} {profile?.last_name}
              </p>
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 capitalize">
                {profile?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {ungrouped.map(item => (
              <NavLink key={item.path} item={item} onClose={onClose} />
            ))}
          </div>

          {groups.map(group => (
            <div key={group} className="mt-4">
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors"
              >
                {group}
                {collapsedGroups.has(group) ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {!collapsedGroups.has(group) && (
                <div className="space-y-1 mt-1">
                  {groupedMap[group].map(item => (
                    <NavLink key={item.path} item={item} onClose={onClose} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={async () => { await signOut(); navigate('/login'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
