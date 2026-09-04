import { SidebarLayoutEntry, TenantSettings } from './types';

/**
 * Nav groups no tenant can hide or move — "System Settings" is where this
 * very customization screen lives, so hiding it would lock a school out of
 * ever changing it back.
 */
export const SIDEBAR_LOCKED_GROUPS = new Set(['System Settings']);

/**
 * Resolves a tenant's stored sidebar_layout against the nav groups actually
 * present for the current viewer's role/plan, returning the ordered list of
 * group names to render. Explicitly-ordered, visible groups come first, in
 * the saved order; locked groups and anything the stored layout doesn't
 * mention (new since the tenant last saved, or not present for this
 * particular role) are appended after, in their original relative order —
 * same fail-safe convention as resolveDashboardLayout.
 */
export function resolveSidebarLayout(
  stored: TenantSettings['sidebar_layout'],
  presentGroups: string[]
): string[] {
  if (!stored || stored.length === 0) return presentGroups;

  const customizable = new Set(presentGroups.filter(g => !SIDEBAR_LOCKED_GROUPS.has(g)));
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const entry of stored) {
    if (!customizable.has(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    if (entry.visible) ordered.push(entry.id);
  }
  // Locked groups, plus any customizable group the stored layout doesn't
  // mention (new since the tenant last saved, or absent for this role),
  // fall in after the explicitly-ordered ones, in their original relative order.
  for (const g of presentGroups) {
    if (!seen.has(g)) ordered.push(g);
  }
  return ordered;
}

/** Builds the initial editable list for the Appearance settings screen. */
export function buildEditableSidebarLayout(
  stored: TenantSettings['sidebar_layout'],
  presentGroups: string[]
): SidebarLayoutEntry[] {
  const customizable = presentGroups.filter(g => !SIDEBAR_LOCKED_GROUPS.has(g));
  if (!stored || stored.length === 0) return customizable.map(id => ({ id, visible: true }));

  const seen = new Set<string>();
  const result: SidebarLayoutEntry[] = [];
  for (const entry of stored) {
    if (customizable.includes(entry.id) && !seen.has(entry.id)) {
      result.push(entry);
      seen.add(entry.id);
    }
  }
  for (const id of customizable) {
    if (!seen.has(id)) result.push({ id, visible: true });
  }
  return result;
}
