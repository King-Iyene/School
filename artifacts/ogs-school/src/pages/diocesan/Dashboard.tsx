import { Package, BarChart2, Tag, Truck, PackagePlus, PackageCheck, ShoppingCart, Send, FileText, Users, TrendingUp, Star, List, GraduationCap, Calendar, DollarSign } from 'lucide-react';
import { navigate } from '../../components/hooks/useLocation';
import { useAuth } from '../../context/AuthContext';

const INVENTORY_LINKS = [
  { label: 'Item Categories',  path: '/inventory/categories',   icon: Tag },
  { label: 'Item List',        path: '/inventory/items',        icon: Package },
  { label: 'Stores',           path: '/inventory/stores',       icon: PackageCheck },
  { label: 'Suppliers',        path: '/inventory/suppliers',    icon: Truck },
  { label: 'Receive Items',    path: '/inventory/receive',      icon: PackagePlus },
  { label: 'Receive List',     path: '/inventory/receive-list', icon: PackageCheck },
  { label: 'Sell Items',       path: '/inventory/sell',         icon: ShoppingCart },
  { label: 'Issue Item',       path: '/inventory/issue',        icon: Send },
];

const REPORT_LINKS = [
  { label: 'Student Report',    path: '/reports/student',        icon: Users },
  { label: 'Guardian Reports',  path: '/reports/guardian',       icon: Users },
  { label: 'Student History',   path: '/reports/history',        icon: FileText },
  { label: 'Fees Statement',    path: '/reports/fees-statement', icon: DollarSign },
  { label: 'Balance Fees',      path: '/reports/balance-fees',   icon: DollarSign },
  { label: 'Class Report',      path: '/reports/class',          icon: GraduationCap },
  { label: 'Exam Routine',      path: '/reports/exam-routine',   icon: Calendar },
  { label: 'Merit List',        path: '/reports/merit-list',     icon: Star },
  { label: 'Mark Sheet',        path: '/reports/mark-sheet',     icon: FileText },
  { label: 'Tabulation Sheet',  path: '/reports/tabulation',     icon: List },
  { label: 'Progress Card',     path: '/reports/progress-card',  icon: TrendingUp },
  { label: 'Transaction Report',path: '/reports/transactions',   icon: BarChart2 },
  { label: 'Merit List',        path: '/reports/merit-list',     icon: Star },
  { label: 'Online Exam Report',path: '/reports/online-exam',    icon: BarChart2 },
  { label: 'Student Fine',      path: '/reports/fines',          icon: FileText },
  { label: 'User Log',          path: '/reports/user-log',       icon: FileText },
];

export default function DiocesanDashboard() {
  const { profile } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Welcome, {profile?.first_name || 'Diocesan Official'}</h1>
        <p className="text-slate-500 text-sm mt-1">Diocesan oversight portal — Inventory &amp; Reports</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20 cursor-pointer hover:shadow-xl hover:shadow-emerald-500/30 transition-all"
          onClick={() => navigate('/inventory/items')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-lg">Inventory</p>
              <p className="text-emerald-100 text-xs">{INVENTORY_LINKS.length} sections</p>
            </div>
          </div>
          <p className="text-sm text-emerald-100">Manage and track school inventory, stores, suppliers, and item transactions.</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20 cursor-pointer hover:shadow-xl hover:shadow-blue-500/30 transition-all"
          onClick={() => navigate('/reports/student')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-lg">Reports</p>
              <p className="text-blue-100 text-xs">{REPORT_LINKS.length} report types</p>
            </div>
          </div>
          <p className="text-sm text-blue-100">Access student, financial, academic, and operational reports.</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Inventory</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {INVENTORY_LINKS.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-all text-left shadow-sm">
                <Icon className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Reports</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {REPORT_LINKS.map((item, i) => {
            const Icon = item.icon;
            return (
              <button key={item.path + i} onClick={() => navigate(item.path)}
                className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all text-left shadow-sm">
                <Icon className="w-4 h-4 flex-shrink-0 text-blue-500" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
