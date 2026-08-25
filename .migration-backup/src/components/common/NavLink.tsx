import { useLocation, navigate } from '../hooks/useLocation';
import { NavItem } from '../layout/navConfig';

interface NavLinkProps {
  item: NavItem;
  onClose?: () => void;
}

export function NavLink({ item, onClose }: NavLinkProps) {
  const location = useLocation();
  const isActive = location === item.path;
  const Icon = item.icon;

  const handleClick = () => {
    navigate(item.path);
    onClose?.();
  };

  return (
    <button
      onClick={handleClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
        ${isActive
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }
      `}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {item.label}
      {isActive && <div className="ml-auto w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
    </button>
  );
}
