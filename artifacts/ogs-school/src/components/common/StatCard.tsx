import { ElementType } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ElementType;
  trend?: string;
  trendUp?: boolean;
  color?: 'emerald' | 'blue' | 'amber' | 'red' | 'slate';
}

const colorMap = {
  emerald: { iconBg: 'bg-emerald-500', iconRing: 'ring-emerald-100 dark:ring-emerald-500/20', accent: 'from-emerald-50 dark:from-emerald-500/10', trend: 'text-emerald-600' },
  blue:    { iconBg: 'bg-blue-500',    iconRing: 'ring-blue-100 dark:ring-blue-500/20',       accent: 'from-blue-50 dark:from-blue-500/10',       trend: 'text-blue-600' },
  amber:   { iconBg: 'bg-amber-500',   iconRing: 'ring-amber-100 dark:ring-amber-500/20',     accent: 'from-amber-50 dark:from-amber-500/10',     trend: 'text-amber-600' },
  red:     { iconBg: 'bg-red-500',     iconRing: 'ring-red-100 dark:ring-red-500/20',         accent: 'from-red-50 dark:from-red-500/10',         trend: 'text-red-600' },
  slate:   { iconBg: 'bg-slate-500',   iconRing: 'ring-slate-100 dark:ring-app-border',       accent: 'from-slate-50 dark:from-app-surface-alt',  trend: 'text-app-text-muted' },
};

export default function StatCard({ title, value, icon: Icon, trend, trendUp, color = 'emerald' }: StatCardProps) {
  const c = colorMap[color];

  return (
    <div className={`bg-app-surface rounded-2xl p-4 border border-app-border shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br ${c.accent} to-app-surface`}>
      <div className={`w-9 h-9 ${c.iconBg} rounded-xl flex items-center justify-center mb-3 ring-4 ${c.iconRing}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-xs font-medium text-app-text-muted leading-tight">{title}</p>
      <p className="text-2xl font-bold text-app-text mt-0.5 leading-none">{value}</p>
      {trend && (
        <p className={`text-xs mt-1.5 font-medium ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
          {trendUp ? '↑' : '↓'} {trend}
        </p>
      )}
    </div>
  );
}
