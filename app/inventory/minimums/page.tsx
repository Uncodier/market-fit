'use client';

import { useState } from 'react';
import { useSite } from '@/app/context/SiteContext';
import { isDemoSiteId, isRealSiteId } from '@/lib/demo-utils';
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { SearchInput } from '@/app/components/ui/search-input';
import { QuickNav } from '@/app/components/ui/quick-nav';
import { ProcurementWorkspace } from '@/app/purchases/procurement/ui/workspace';
import { RuleScreenLoading } from '@/app/purchases/procurement/ui/rule-screen-loading';
import { ReplenishmentRules } from '@/app/purchases/procurement/replenishment/rules';
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n';
import { policyNavigation } from '@/app/purchases/procurement/components/policy-navigation';

export default function InventoryMinimumsPage() {
  const { currentSite } = useSite();
  const { t } = useProcurementI18n();
  if (!currentSite) return <RuleScreenLoading minimums />;
  if (!isRealSiteId(currentSite.id) && !isDemoSiteId(currentSite.id)) return <div className="p-6">{t('procurement.policy.page.realWorkspace')}</div>;
  return <MinimumsWorkspace key={currentSite.id} siteId={currentSite.id} />;
}

function MinimumsWorkspace({ siteId }: { siteId: string }) {
  const { t } = useProcurementI18n();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  return <ProcurementWorkspace title={t('procurement.policy.page.minimums')} toolbar={
    <div data-policy-toolbar className="flex w-full flex-wrap items-center gap-2 py-3">
      <Tabs value={status} onValueChange={value => setStatus(value as typeof status)}>
        <TabsList className="h-8 w-auto rounded-full bg-muted/30 p-0.5">
          {(['all', 'enabled', 'disabled'] as const).map(value => <TabsTrigger key={value} value={value} className="rounded-full px-4 text-xs">
            {t(value === 'all' ? 'procurement.values.all' : `procurement.workflow.replenishment.${value}`)}
          </TabsTrigger>)}
        </TabsList>
      </Tabs>
      <SearchInput aria-label={t('procurement.policy.rules.search')} placeholder={t('procurement.policy.rules.search')}
        value={search} onChange={event => setSearch(event.target.value)} />
    </div>
  } className="px-0 py-8 pb-16 md:px-0 lg:px-0">
    <div className="mx-auto flex max-w-[1200px] justify-center gap-8">
      <div className="min-w-0 max-w-[880px] flex-1 space-y-6 px-4 md:px-16">
        <ReplenishmentRules siteId={siteId} search={search} status={status} />
      </div>
      <QuickNav sections={policyNavigation('rules', 'replenishment', [], t)} />
    </div>
  </ProcurementWorkspace>;
}