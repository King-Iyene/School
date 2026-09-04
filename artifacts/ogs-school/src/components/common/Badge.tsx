import { LucideIcon } from 'lucide-react';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  icon?: LucideIcon;
}

const variants = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  default: 'bg-app-surface-alt text-app-text border-app-border',
};

export default function Badge({ label, variant = 'default', icon: Icon }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${variants[variant]}`}>
      {Icon && <Icon size={12} />}
      {label}
    </span>
  );
}
