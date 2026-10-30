'use client';

import { useState } from 'react';
import { ProcurementSettingsSkeleton } from '../ui/settings-skeleton';
import { RuleScreenLoading, RuleCardsSkeleton, RuleIndexSkeleton } from '../ui/rule-screen-loading';
import { useSite } from '@/app/context/SiteContext';
import type { SectionCardFooterProps } from '@/app/components/ui/section-card';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import { isDemoModeActive, isDemoSiteId, isRealSiteId } from '@/lib/demo-utils';
import { ProcurementDemoNotice } from '../ui/demo-notice';
import { usePolicyDocument } from './use-policy-document';
import { SettingsEditor } from './settings-editor';
import { RulesEditor } from './rules-editor';
import { PolicySimulator } from './policy-simulator';
import { ProcurementWorkspace, ProcurementState } from '../ui/workspace';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Skeleton } from '@/app/components/ui/skeleton';
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n';
import { QuickNav } from '@/app/components/ui/quick-nav';
import { SearchInput } from '@/app/components/ui/search-input';
import { policyNavigation } from './policy-navigation';
import { PortalSettings } from './portal-settings';
import Link from 'next/link';

export function ProcurementPage({ screen, embedded = false }: { screen: 'settings' | 'rules'; embedded?: boolean }) {
  const { currentSite } = useSite();
  const { t } = useProcurementI18n();
  if (!currentSite) return screen === 'rules' ? <RuleScreenLoading /> : <div className="mx-auto w-full max-w-[880px] px-4 py-8 md:px-16"><ProcurementSettingsSkeleton /></div>;
  if (!isDemoSiteId(currentSite.id) && (!isRealSiteId(currentSite.id) || isDemoModeActive())) return <div className="p-6">{t('procurement.policy.page.realWorkspace')}</div>;
  return <WorkspacePolicy key={`${currentSite.id}:${screen}`} siteId={currentSite.id} siteName={currentSite.name} screen={screen} embedded={embedded} />;
}

function WorkspacePolicy({ siteId, siteName, screen, embedded }: { siteId: string; siteName: string; screen: 'settings' | 'rules'; embedded: boolean }) {
  const policy = usePolicyDocument(siteId);
  const { t, formatNumber } = useProcurementI18n();
  const [confirmReload, setConfirmReload] = useState(false);
  const [status, setStatus] = useState<'all' | 'draft' | 'active' | 'archived'>('all');
  const [search, setSearch] = useState('');
  const demo = isDemoSiteId(siteId) || isDemoModeActive();
  const saveProps: SectionCardFooterProps = {
    dirty: policy.dirty,
    saving: policy.saving,
    onSave: () => void policy.save(),
    saveLabel: t('procurement.policy.page.save'),
    savingLabel: t('procurement.policy.page.saving'),
    saveDisabled: policy.loading || policy.saving || !policy.draft || policy.conflict || demo || (!policy.dirty && policy.revision !== 0),
  };
  const reload = () => {
    if (policy.dirty) { setConfirmReload(true); return; }
    void policy.reload();
  };
  return <ProcurementWorkspace embedded={embedded} title={t(screen === 'settings' ? 'procurement.policy.page.settings' : 'procurement.policy.page.rules')} toolbar={
    !embedded && <div data-policy-toolbar className="flex w-full flex-wrap items-center justify-between gap-3 py-3">
      {screen === 'rules' && <div data-rule-tabs className="flex min-w-0 flex-wrap items-center gap-2">
      <Tabs value={status} onValueChange={value => setStatus(value as typeof status)}><TabsList className="h-8 w-auto rounded-full bg-muted/30 p-0.5">
        {(['all', 'draft', 'active', 'archived'] as const).map(value => <TabsTrigger key={value} className="rounded-full px-4 text-xs" value={value}>{t(`procurement.values.${value}`)}</TabsTrigger>)}
      </TabsList></Tabs>
      <SearchInput aria-label={t('procurement.policy.rules.search')} placeholder={t('procurement.policy.rules.search')}
        value={search} onChange={event => setSearch(event.target.value)} />
      </div>}
      {screen === 'settings' && <div className="min-w-0"><p className="truncate text-sm font-medium">{siteName}</p>{policy.revision === undefined ? <Skeleton className="h-3 w-20" /> : <p className="text-xs text-muted-foreground">{t('procurement.policy.page.revision', { number: formatNumber(policy.revision) })}</p>}</div>}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
      {policy.dirty && <Badge variant="outline" className="hidden sm:inline-flex">{t('procurement.policy.page.unsaved')}</Badge>}

      </div>
    </div>} className="px-0 py-8 pb-16 md:px-0 lg:px-0">
    <div className="mx-auto flex max-w-[1200px] justify-center gap-8">
    <div className="min-w-0 max-w-[880px] flex-1 space-y-6 px-4 text-sm md:px-16">
    <p className="text-sm text-muted-foreground">{t('procurement.policy.page.description')}</p>
    {demo && <ProcurementDemoNotice />}
    {screen === 'settings' && <>
      <Link className="block text-sm underline" href="/purchases/rules">{t('procurement.policy.page.rules')}</Link>
      <PortalSettings siteId={siteId} disabled={demo} />
    </>}
    {policy.loading ? (screen === 'rules' ? <RuleCardsSkeleton /> : <ProcurementSettingsSkeleton includePortal={false} />)
      : <ProcurementState error={policy.error} errorIsLocalized onRetry={reload} />}
    {demo && <p role="alert">{t('procurement.policy.page.demo')}</p>}
    <ConfirmDialog open={confirmReload} onOpenChange={setConfirmReload} title={t('procurement.policy.page.discardTitle')}
      description={t('procurement.policy.page.discardDescription')}
      confirmLabel={t('procurement.policy.page.discard')} cancelLabel={t('procurement.policy.page.cancel')} variant="destructive" onConfirm={policy.reload} />
    {policy.draft && <div className="min-w-0 space-y-6">
      {screen === 'settings' ? <fieldset disabled={policy.saving || demo}><SettingsEditor siteId={siteId} value={policy.draft.settings} saveProps={saveProps}
        onChange={(settings) => policy.edit({ ...policy.draft!, settings })} /></fieldset>
        : <RulesEditor status={status} onStatusChange={setStatus} search={search} onSearchChange={setSearch} disabled={policy.saving || demo} siteId={siteId} rules={policy.draft.rules} timeZone={policy.draft.settings.timeZone} ruleSaveProps={id => ({ ...saveProps, onSave: () => void policy.save(id),
            saving: policy.savingRuleId === id, saveDisabled: policy.saving || policy.conflict || demo || !policy.isRuleDirty(id) })}
          onChange={(rules) => policy.edit({ ...policy.draft!, rules })} />}
      <PolicySimulator siteId={siteId} document={policy.draft} />
    </div>}
    </div>
    {policy.draft && <QuickNav sections={policyNavigation(screen, 'policy', (policy.draft?.rules ?? []).filter(rule => (status === 'all' || rule.status === status) && rule.name.toLowerCase().includes(search.toLowerCase())), t)} />}
    {screen === 'rules' && policy.loading && <RuleIndexSkeleton />}
    </div>
  </ProcurementWorkspace>;
}