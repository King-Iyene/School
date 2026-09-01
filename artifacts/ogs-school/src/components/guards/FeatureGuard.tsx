import { ReactNode } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useTenantSettings } from '../../context/TenantContext';
import type { PlanTier } from '../../lib/types';
import {
  Feature,
  PLAN_LABELS,
  minimumPlanFor,
  planMeetsMinimum,
  isFeatureEnabledForPlan,
} from '../../lib/planFeatures';
import { navigate } from '../hooks/useLocation';

interface FeatureGuardProps {
  /** Gate on a specific feature flag (preferred — maps to its minimum plan automatically). */
  feature?: Feature;
  /** Or gate directly on a minimum plan tier, e.g. <FeatureGuard plan="premium">. */
  plan?: PlanTier;
  children: ReactNode;
  /** Render nothing instead of the upgrade prompt (for hiding nav items/widgets). */
  silent?: boolean;
}

/**
 * Wrap any route or section that should be locked behind a plan tier.
 * Usage: <FeatureGuard plan="premium">...</FeatureGuard> or
 *        <FeatureGuard feature="cbt_engine">...</FeatureGuard>
 */
export function FeatureGuard({ feature, plan, children, silent = false }: FeatureGuardProps) {
  const { tenant } = useTenantSettings();
  const currentPlan = tenant?.plan_tier;

  const allowed = feature
    ? isFeatureEnabledForPlan(currentPlan, feature)
    : plan
    ? planMeetsMinimum(currentPlan, plan)
    : true;

  if (allowed) return <>{children}</>;
  if (silent) return null;

  const requiredPlan = plan ?? (feature ? minimumPlanFor(feature) : 'premium');

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">This feature needs an upgrade</h2>
        <p className="text-slate-500 text-sm mb-6">
          This module is only available on the <span className="font-semibold text-slate-700">{PLAN_LABELS[requiredPlan]}</span> plan
          {currentPlan && <> — you're currently on <span className="font-semibold">{PLAN_LABELS[currentPlan]}</span></>}.
        </p>
        <button
          onClick={() => navigate('/saas-admin')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Upgrade Plan
        </button>
      </div>
    </div>
  );
}

export default FeatureGuard;
