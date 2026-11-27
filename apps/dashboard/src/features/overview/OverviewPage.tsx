import { ComingSoonPage } from '@/features/shell/ComingSoonPage';
import { PlanUsage } from './PlanUsage';

/**
 * Overview: analytics arrive in P10. Until then the page shows the only numbers that are already
 * real — plan & usage (DECISIONS H6) — and an honest "coming soon" for the rest.
 */
export function OverviewPage() {
  return (
    <ComingSoonPage section="overview">
      <PlanUsage />
    </ComingSoonPage>
  );
}
