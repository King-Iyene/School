import { DashboardLayoutEntry, TenantSettings } from './types';

/**
 * The super-admin dashboard's reorderable/hideable widgets, in their default
 * order. `span` is the widget's width out of a 12-column grid — widgets flow
 * left-to-right, top-to-bottom in whatever order resolveDashboardLayout()
 * returns, wrapping to a new row whenever the current row runs out of room
 * (plain CSS grid auto-flow), so any combination/order of visible widgets
 * still lays out sensibly without needing a fixed pairing.
 */
export const DASHBOARD_WIDGETS: { id: string; label: string; span: number }[] = [
  { id: 'stat-students', label: 'Students count', span: 3 },
  { id: 'stat-teachers', label: 'Teachers count', span: 3 },
  { id: 'stat-parents', label: 'Parents count', span: 3 },
  { id: 'stat-staff', label: 'Staff count', span: 3 },
  { id: 'attendance-progress', label: "Today's staff attendance", span: 7 },
  { id: 'staff-authorizations', label: 'Staff authorizations (leave approvals)', span: 5 },
  { id: 'requisitions', label: 'Requisitions awaiting approval', span: 6 },
  { id: 'todo', label: 'To-do list', span: 6 },
  { id: 'financials', label: 'Income and expenses', span: 12 },
  { id: 'operations-stream', label: 'Campus operations & incident stream', span: 7 },
  { id: 'institutional-calendar', label: 'Institutional calendar', span: 5 },
  { id: 'quickdispatch', label: 'Administrative quick dispatch', span: 12 },
];

const DEFAULT_LAYOUT: DashboardLayoutEntry[] = DASHBOARD_WIDGETS.map(w => ({ id: w.id, visible: true }));

/**
 * Resolves a tenant's stored dashboard_layout into a complete, ordered list —
 * falling back to the default for anything unset, and silently dropping any
 * stale/unknown widget ids so a future removal of a widget can't leave a
 * dangling entry a tenant saved earlier.
 */
export function resolveDashboardLayout(stored: TenantSettings['dashboard_layout']): DashboardLayoutEntry[] {
  if (!stored || stored.length === 0) return DEFAULT_LAYOUT;
  const knownIds = new Set(DASHBOARD_WIDGETS.map(w => w.id));
  const seen = new Set<string>();
  const resolved: DashboardLayoutEntry[] = [];
  for (const entry of stored) {
    if (knownIds.has(entry.id) && !seen.has(entry.id)) {
      resolved.push(entry);
      seen.add(entry.id);
    }
  }
  // Append any widget the stored layout doesn't mention yet (e.g. added after the tenant last saved).
  for (const w of DASHBOARD_WIDGETS) {
    if (!seen.has(w.id)) resolved.push({ id: w.id, visible: true });
  }
  return resolved;
}

/** Tailwind needs literal class names to find via its content scan — this
 * maps each widget's 12-col span to one, rather than constructing the class
 * with string interpolation at render time. */
export const SPAN_CLASS: Record<number, string> = {
  3: 'lg:col-span-3',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  12: 'lg:col-span-12',
};
