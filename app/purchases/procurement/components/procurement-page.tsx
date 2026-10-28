'use client';

import { useState } from 'react';
import { useSite } from '@/app/context/SiteContext';
import { Button } from '@/app/components/ui/button';
import { TopBarPrimaryActions } from '@/app/components/navigation/topbar-primary-actions';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import { isDemoModeActive, isRealSiteId } from '@/lib/demo-utils';
import { usePolicyDocument } from './use-policy-document';
import { SettingsEditor } from './settings-editor';
import { RulesEditor } from './rules-editor';
import { PolicySimulator } from './policy-simulator';
import { ProcurementWorkspace, ProcurementState } from '../ui/workspace';
import { Badge } from '@/app/components/ui/badge';

export function ProcurementPage({ screen }: { screen: 'settings' | 'rules' }) {
  const { currentSite } = useSite();
  if (!currentSite || !isRealSiteId(currentSite.id)) return <div className="p-6">Select a real workspace to manage procurement. Demo saves are not supported.</div>;
  return <WorkspacePolicy key={`${currentSite.id}:${screen}`} siteId={currentSite.id} siteName={currentSite.name} screen={screen} />;
}

function WorkspacePolicy({ siteId, siteName, screen }: { siteId: string; siteName: string; screen: 'settings' | 'rules' }) {
  const policy = usePolicyDocument(siteId);
  const [confirmReload, setConfirmReload] = useState(false);
  const demo = isDemoModeActive();
  const reload = () => {
    if (policy.dirty) { setConfirmReload(true); return; }
    void policy.reload();
  };
  return <ProcurementWorkspace title={screen === 'settings' ? 'Procurement settings' : 'Procurement rules'} toolbar={
    <div className="flex w-full items-center justify-between gap-3 py-3">
      <div className="min-w-0"><p className="truncate text-sm font-medium">{siteName}</p><p className="text-xs text-muted-foreground">{policy.revision === undefined ? 'Loading revision' : `Revision ${policy.revision}`}</p></div>
      <div className="flex items-center gap-2">
      {policy.dirty && <Badge variant="outline" className="hidden sm:inline-flex">Unsaved changes</Badge>}
      <Button type="button" variant="ghost" size="sm" disabled={policy.loading || policy.saving} onClick={reload}>{policy.conflict ? 'Reload latest policy (discard draft)' : 'Reload policy'}</Button>
      </div>
    </div>}>
    <TopBarPrimaryActions><Button type="button" size="sm" disabled={policy.loading || policy.saving || !policy.draft || policy.conflict || demo || (!policy.dirty && policy.revision !== 0)} onClick={() => void policy.save()}>
      {policy.saving ? 'Saving policy…' : 'Save policy'}
    </Button></TopBarPrimaryActions>
    <div className={screen === 'settings' ? 'mx-auto max-w-5xl space-y-6' : 'space-y-6'}>
    <p className="text-sm text-muted-foreground">Manage defaults and rules for new procurement workflows. Existing commerce documents are unchanged. Unsaved edits are discarded when switching workspaces or screens.</p>
    <ProcurementState loading={policy.loading} error={policy.error} onRetry={reload} />
    {policy.notice && <p role="status" className="rounded-xl border bg-background p-4 text-sm">{policy.notice}</p>}
    {demo && <p role="alert">Demo mode cannot save procurement policies. Exit demo mode to manage a real workspace.</p>}
    <ConfirmDialog open={confirmReload} onOpenChange={setConfirmReload} title="Discard unsaved procurement edits?"
      description="Your local draft will be replaced with the latest saved policy for this workspace. This cannot be undone."
      confirmLabel="Discard draft and reload" variant="destructive" onConfirm={policy.reload} />
    {policy.draft && <fieldset disabled={policy.saving || demo} className="min-w-0 space-y-6">
      {screen === 'settings' ? <SettingsEditor siteId={siteId} value={policy.draft.settings}
        onChange={(settings) => policy.edit({ ...policy.draft!, settings })} />
        : <RulesEditor disabled={policy.saving || demo} siteId={siteId} rules={policy.draft.rules} timeZone={policy.draft.settings.timeZone}
          onChange={(rules) => policy.edit({ ...policy.draft!, rules })} />}
      <PolicySimulator siteId={siteId} document={policy.draft} />
    </fieldset>}
    </div>
  </ProcurementWorkspace>;
}