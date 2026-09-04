import { DashboardLayoutEntry, TenantSettings } from './types';

/** The super-admin dashboard's reorderable/hideable sections, in their default order. */
export const DASHBOARD_WIDGETS: { id: string; label: string }[] = [
  { id: 'stats', label: 'Headcount stat tiles' },
  { id: 'attendance', label: "Today's attendance & staff authorizations" },
  { id: 'financials', label: 'Income and expenses' },
  { id: 'operations', label: 'Campus operations & institutional calendar' },
  { id: 'quickdispatch', label: 'Administrative quick dispatch' },
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
