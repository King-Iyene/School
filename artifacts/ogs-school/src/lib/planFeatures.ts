import type { PlanTier } from './types';

/**
 * Every gate-able module in the product. Add new ones here first, then wire
 * them into PLAN_FEATURES below and reference them from navConfig.ts / pages.
 */
export type Feature =
  | 'core_academics'
  | 'student_directory'
  | 'attendance'
  | 'report_cards'
  | 'parent_student_portal'
  | 'payment_gateway_collections'
  | 'cbt_engine'
  | 'lesson_plan_workflow'
  | 'library_inventory_store'
  | 'bulk_printing'
  | 'sms_email_broadcasts'
  | 'hr_payroll'
  | 'financial_accounting'
  | 'dormitory'
  | 'transport'
  | 'campus_security'
  | 'multi_branch'
  | 'white_labeling'
  | 'custom_domain';

export const PLAN_ORDER: PlanTier[] = ['starter', 'premium', 'enterprise'];

export const PLAN_LABELS: Record<PlanTier, string> = {
  starter: 'Starter',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

export const PLAN_STUDENT_LIMITS: Record<PlanTier, number | null> = {
  starter: 250,
  premium: 1000,
  enterprise: null,
};

// NGN monthly list price — used for the pricing grid and the SaaS admin MRR
// estimate. Update here if pricing changes; nothing else needs to change.
export const PLAN_PRICES_NGN: Record<PlanTier, number> = {
  starter: 15000,
  premium: 45000,
  enterprise: 120000,
};

const STARTER_FEATURES: Feature[] = [
  'core_academics',
  'student_directory',
  'attendance',
  'report_cards',
  'parent_student_portal',
];

const PREMIUM_FEATURES: Feature[] = [
  ...STARTER_FEATURES,
  'payment_gateway_collections',
  'cbt_engine',
  'lesson_plan_workflow',
  'library_inventory_store',
  'bulk_printing',
  'sms_email_broadcasts',
];

const ENTERPRISE_FEATURES: Feature[] = [
  ...PREMIUM_FEATURES,
  'hr_payroll',
  'financial_accounting',
  'dormitory',
  'transport',
  'campus_security',
  'multi_branch',
  'white_labeling',
  'custom_domain',
];

export const PLAN_FEATURES: Record<PlanTier, Feature[]> = {
  starter: STARTER_FEATURES,
  premium: PREMIUM_FEATURES,
  enterprise: ENTERPRISE_FEATURES,
};

export function isFeatureEnabledForPlan(plan: PlanTier | undefined | null, feature: Feature): boolean {
  if (!plan) return true; // no tenant resolved yet (e.g. legacy/local dev) — fail open, not closed
  return PLAN_FEATURES[plan].includes(feature);
}

/** Smallest plan tier that unlocks a given feature. */
export function minimumPlanFor(feature: Feature): PlanTier {
  for (const tier of PLAN_ORDER) {
    if (PLAN_FEATURES[tier].includes(feature)) return tier;
  }
  return 'enterprise';
}

export function planRank(plan: PlanTier): number {
  return PLAN_ORDER.indexOf(plan);
}

/** True if `plan` is at least as capable as `minPlan` (e.g. premium >= starter). */
export function planMeetsMinimum(plan: PlanTier | undefined | null, minPlan: PlanTier): boolean {
  if (!plan) return true;
  return planRank(plan) >= planRank(minPlan);
}
