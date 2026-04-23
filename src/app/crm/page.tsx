import { ActionsDueWidget } from '@/components/crm/ActionsDueWidget';
import { ForecastWidget } from '@/components/crm/ForecastWidget';
import { WipWidget } from '@/components/crm/WipWidget';
import { UpcomingThisWeekWidget } from '@/components/crm/UpcomingThisWeekWidget';
import { KeyAccountHealthWidget } from '@/components/crm/KeyAccountHealthWidget';
import { DealsAtRiskWidget } from '@/components/crm/DealsAtRiskWidget';
import { FirstTimeBanner } from '@/components/crm/FirstTimeBanner';

// /crm — the operational landing view of the CRM module.
// Six widgets in priority order: FirstTimeBanner (dismissible tutorial
// nudge) → Forecast+WIP (money) → Key-Account Health (relationships)
// → Deals at Risk + Actions Due (hot items) → Upcoming (week plan).
//
// The old "JUMP INTO" grid was removed in stint 33.B — it duplicated
// the top-nav tabs and contributed no signal. The home is now pure
// operational dashboard (no navigation).
export default function CrmHomePage() {
  return (
    <div className="space-y-5">
      <FirstTimeBanner />
      <div>
        <h1 className="text-[18px] font-semibold text-ink">CRM home</h1>
        <p className="text-[12.5px] text-ink-muted mt-0.5">
          Daily landing — pipeline forecast, unbilled work, Key Account health, deals at risk,
          actions due today, and what&apos;s hitting this week.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ForecastWidget />
        <WipWidget />
      </div>

      <KeyAccountHealthWidget />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <DealsAtRiskWidget />
        <ActionsDueWidget />
      </div>

      <UpcomingThisWeekWidget />
    </div>
  );
}
