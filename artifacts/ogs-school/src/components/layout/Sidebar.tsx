import { useState, useEffect } from 'react';
import { NavLink } from '../common/NavLink';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import { LogOut, X, ChevronDown, ChevronRight } from 'lucide-react';
import { getNavItems } from './navConfig';
import { navigate } from '../hooks/useLocation';
import { resolveSidebarLayout } from '../../lib/sidebarLayout';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { settings, tenant } = useTenantSettings();
  const navItems = getNavItems(profile?.role, tenant?.plan_tier);
  const groupedMapInit = navItems.filter(i => i.group).reduce((acc, item) => { acc[item.group!] = true; return acc; }, {} as Record<string, boolean>);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set(Object.keys(groupedMapInit)));
  const [schoolName, setSchoolName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    setSchoolName(settings.school_name ?? '');
    setLogoUrl(settings.logo_url ?? '');
  }, [settings.school_name, settings.logo_url]);

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

  const groups = resolveSidebarLayout(settings.sidebar_layout, Object.keys(groupedMap));

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
        w-64 bg-app-surface border-r border-app-border
        flex flex-col transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden bg-app-surface-alt border border-app-border flex items-center justify-center">
              <img
                src={logoUrl || '/default-logo.png'}
                alt="School logo"
                className="w-full h-full object-contain p-0.5"
              />
            </div>
            <div className="min-w-0">
              <p className="text-app-text text-sm font-bold leading-tight truncate">{firstName}</p>
              {restName && <p className="text-app-text-muted text-xs truncate">{restName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-app-text-muted hover:text-app-text flex-shrink-0 ml-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {tenant?.plan_tier && (
          <div className="px-4 py-2 border-b border-app-border">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-app-text-muted capitalize">
              <span className={`w-1.5 h-1.5 rounded-full ${tenant.status === 'active' || tenant.status === 'trial' ? 'bg-emerald-500' : tenant.status === 'past_due' ? 'bg-amber-500' : 'bg-red-500'}`} />
              {tenant.plan_tier} Plan &middot; {tenant.status === 'trial' ? 'Trial' : tenant.status}
            </span>
          </div>
        )}

        <div className="px-4 py-3 border-b border-app-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-app-primary flex items-center justify-center flex-shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <span className="text-white text-sm font-semibold">
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-app-text text-sm font-medium truncate">
                {profile?.first_name} {profile?.last_name}
              </p>
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-app-primary/10 text-app-primary capitalize">
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
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-app-text-muted uppercase tracking-wider hover:text-app-text transition-colors"
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

        <div className="p-3 border-t border-app-border">
          <button
            onClick={async () => { await signOut(); navigate('/login'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-app-text-muted hover:text-app-text hover:bg-app-surface-alt rounded-xl transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
