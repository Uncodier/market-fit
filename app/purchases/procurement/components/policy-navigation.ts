import type { ProcurementRule } from '../domain';
import type { QuickNavSection } from '@/app/components/ui/quick-nav';

export function policyNavigation(screen: 'settings' | 'rules', ruleType: string, rules: ProcurementRule[], t: (key: string) => string): QuickNavSection[] {
  if (ruleType === 'replenishment') return [
    { id: 'procurement-replenishment-minimums', title: t('procurement.workflow.replenishment.inventory') },
    { id: 'procurement-replenishment-cases', title: t('procurement.workflow.replenishment.openCases') },
  ];
  const sections: QuickNavSection[] = screen === 'settings'
    ? ['general', 'fallback', 'deadlines', 'exceptions', 'urgent', 'notifications'].map(key => ({
      id: `procurement-settings-${key}`, title: t(`procurement.policy.settings.${key}`),
    }))
    : [{ id: 'procurement-rules', title: t('procurement.policy.page.rules'), children: rules.map(rule => ({
      id: `procurement-rule-${rule.id}`, title: rule.name,
    })) }];
  return [...(screen === 'settings' ? [{ id: 'procurement-settings-portal', title: t('procurement.workflow.tender.workspacePortal') }] : []),
    ...sections, { id: 'procurement-simulator', title: t('procurement.policy.simulator.title') }];
}