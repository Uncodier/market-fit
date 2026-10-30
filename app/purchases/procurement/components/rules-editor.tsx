import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import type { SectionCardFooterProps } from '@/app/components/ui/section-card';
import { procurementRuleSchema, type ProcurementRule } from '../domain';
import { RuleEditor } from './rule-editor';
import { useProcurementI18n } from '../i18n/use-procurement-i18n';
import { EmptyCard } from '@/app/components/ui/empty-card';
import { ClipboardList, PlusCircle } from '@/app/components/ui/icons';
import { TopBarPrimaryActions } from '@/app/components/navigation/topbar-primary-actions';

export function RulesEditor({ rules, onChange, siteId, timeZone, disabled = false, ruleSaveProps, search = '', onSearchChange, status = 'all', onStatusChange }: {
  rules: ProcurementRule[]; onChange: (rules: ProcurementRule[]) => void; siteId: string; timeZone: string; disabled?: boolean;
  status?: 'all' | ProcurementRule['status']; onStatusChange?: (status: 'all' | ProcurementRule['status']) => void;
  search?: string; onSearchChange?: (value: string) => void;
  ruleSaveProps?: (id: string) => SectionCardFooterProps;
}) {
  const { t, formatNumber } = useProcurementI18n();
  const [expanded, setExpanded] = useState<string[]>([]);
  const visible = rules.filter(rule => (status === 'all' || rule.status === status) && rule.name.toLowerCase().includes(search.toLowerCase()));
  const toggle = (id: string) => setExpanded(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
  return <section id="procurement-rules" className="scroll-mt-36 space-y-4">
    <div className="space-y-1"><h2 className="text-lg font-semibold">{t('procurement.policy.page.rules')}</h2>
      <p className="text-sm text-muted-foreground">{t('procurement.policy.rules.description')}</p></div>
    <TopBarPrimaryActions>
      <Button type="button" size="sm" disabled={disabled || rules.length >= 500} onClick={() => {
        const rule = procurementRuleSchema.parse({ id: crypto.randomUUID(), name: t('procurement.policy.rule.new'), type: 'approval', event: 'requisition' });
        onChange([...rules, rule]); setExpanded(ids => [...ids, rule.id]); onSearchChange?.(''); onStatusChange?.('all');
      }}><PlusCircle className="mr-2 h-4 w-4" />{t('procurement.policy.rules.create')}</Button>
    </TopBarPrimaryActions>
    <p className="text-xs text-muted-foreground">{t('procurement.policy.rules.count', { number: formatNumber(visible.length) })}</p>
    {visible.map(rule => <RuleEditor key={rule.id} value={rule} siteId={siteId} timeZone={timeZone} disabled={disabled}
      expanded={expanded.includes(rule.id)} onToggle={() => toggle(rule.id)} onClose={() => toggle(rule.id)} saveProps={ruleSaveProps?.(rule.id)}
      onChange={next => onChange(rules.map(item => item.id === rule.id ? next : item))} />)}
    {!visible.length && <EmptyCard title={t('procurement.policy.rules.empty')} description="" icon={<ClipboardList size={24} />}
      showShadow={false} showHint={false} contentClassName="min-h-[180px] py-6" />}
  </section>;
}
