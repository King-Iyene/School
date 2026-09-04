import { ShieldCheck, Info } from 'lucide-react';

interface PermissionRow {
  module: string;
  super_admin: boolean;
  teacher: boolean;
  student: boolean;
  parent: boolean;
  accountant: boolean;
}

const PERMISSIONS: PermissionRow[] = [
  { module: 'Dashboard',    super_admin: true,  teacher: true,  student: true,  parent: true,  accountant: true  },
  { module: 'Students',     super_admin: true,  teacher: true,  student: false, parent: false, accountant: false },
  { module: 'Classes',      super_admin: true,  teacher: true,  student: false, parent: false, accountant: false },
  { module: 'Attendance',   super_admin: true,  teacher: true,  student: true,  parent: true,  accountant: false },
  { module: 'Grades',       super_admin: true,  teacher: true,  student: true,  parent: true,  accountant: false },
  { module: 'Finance',      super_admin: true,  teacher: false, student: false, parent: false, accountant: true  },
  { module: 'HR',           super_admin: true,  teacher: false, student: false, parent: false, accountant: false },
  { module: 'Library',      super_admin: true,  teacher: true,  student: true,  parent: false, accountant: false },
  { module: 'Transport',    super_admin: true,  teacher: false, student: true,  parent: true,  accountant: false },
  { module: 'Dormitory',    super_admin: true,  teacher: false, student: true,  parent: true,  accountant: false },
  { module: 'Inventory',    super_admin: true,  teacher: false, student: false, parent: false, accountant: true  },
  { module: 'Reports',      super_admin: true,  teacher: true,  student: false, parent: false, accountant: true  },
];

const ROLE_LABELS: { key: keyof Omit<PermissionRow, 'module'>; label: string }[] = [
  { key: 'super_admin', label: 'Super Admin' },
  { key: 'teacher',     label: 'Teacher'     },
  { key: 'student',     label: 'Student'     },
  { key: 'parent',      label: 'Parent'      },
  { key: 'accountant',  label: 'Accountant'  },
];

function PermissionCheck({ value }: { value: boolean }) {
  return (
    <div className="flex justify-center">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center ${
          value ? 'bg-emerald-100' : 'bg-slate-100'
        }`}
      >
        {value ? (
          <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
    </div>
  );
}

export default function RolePermission() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-app-text">Role Permissions</h1>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">Permissions are managed by the system administrator</p>
          <p className="text-xs text-blue-600 mt-1">
            The table below shows a read-only overview of which roles have access to each module. To modify permissions,
            please contact your system administrator.
          </p>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-app-surface-alt text-app-text-muted text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-medium">Module / Page</th>
              {ROLE_LABELS.map((r) => (
                <th key={r.key} className="px-4 py-3 text-center font-medium">{r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {PERMISSIONS.map((row, idx) => (
              <tr
                key={row.module}
                className={`transition-colors ${idx % 2 === 0 ? 'bg-app-surface' : 'bg-app-surface-alt/50'} hover:bg-app-surface-alt`}
              >
                <td className="px-4 py-3 font-medium text-app-text">{row.module}</td>
                {ROLE_LABELS.map((r) => (
                  <td key={r.key} className="px-4 py-3">
                    <PermissionCheck value={row[r.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-6 px-2 text-xs text-app-text-muted">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          Access granted
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          No access
        </div>
      </div>
    </div>
  );
}
