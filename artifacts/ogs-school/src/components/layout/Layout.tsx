import { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useLocation } from '../hooks/useLocation';
import { getNavItems } from './navConfig';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import OfflineIndicator from '../common/OfflineIndicator';
import AIAssistantWidget from '../shared/AIAssistantWidget';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile } = useAuth();
  const { tenant } = useTenantSettings();
  const location = useLocation();
  const navItems = getNavItems(profile?.role, tenant?.plan_tier);
  const currentNav = navItems.find(item => item.path === location);
  const title = currentNav?.label || 'Dashboard';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8">
          {children}
        </main>
      </div>
      <OfflineIndicator />
      <AIAssistantWidget />
    </div>
  );
}
