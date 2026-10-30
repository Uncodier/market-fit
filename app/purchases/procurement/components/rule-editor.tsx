import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter, type SectionCardFooterProps } from '@/app/components/ui/section-card';
import { Button } from '@/app/components/ui/button';
import type { ProcurementRule } from '../domain';
import { AmountField, Choice, NumberField, TextField, Toggle, DateTimeField, currencyScale } from './form-fields';
import { ReferencePicker } from './reference-picker';
import { StageEditor } from './stage-editor';
import { RequirementEditor } from './requirement-editor';
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n';
import { policyInsetClassName, policyLegendClassName } from './policy-styles';
import { ChevronDown, ChevronRight } from '@/app/components/ui/icons';

export function RuleEditor({ value, onChange, onClose, siteId, timeZone, saveProps, disabled = false, expanded = true, onToggle }: {
  value: ProcurementRule; onChange: (rule: ProcurementRule) => void; onClose?: () => void; siteId: string; timeZone: string;
  saveProps?: SectionCardFooterProps; disabled?: boolean;
  expanded?: boolean; onToggle?: () => void;
}) {
  const { t, valueLabel, formatNumber } = useProcurementI18n();
  const update = (patch: Partial<ProcurementRule>) => onChange({ ...value, ...patch });
  const cardId = `procurement-rule-${value.id}`;
  return <SectionCard id={cardId} className="scroll-mt-36">
    <SectionCardHeader
      title={value.name || t('procurement.policy.rule.new')}
      description={`${valueLabel(value.event)} · ${valueLabel(value.type)} · ${valueLabel(value.status)}${value.amount ? ` · ${formatNumber(value.amount.valueMinor / currencyScale(value.amount.currency))} ${value.amount.currency}` : ''}`}
      actions={onToggle && <button type="button" aria-label={t('procurement.policy.rules.edit', { name: value.name })}
        aria-expanded={expanded} aria-controls={`${cardId}-body`} onClick={onToggle}
        className="shrink-0 rounded-md p-2 transition-colors hover:bg-muted/50">
        {expanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
      </button>}
    />
    {expanded && <SectionCardContent id={`${cardId}-body`}>
      <fieldset disabled={disabled} className="min-w-0 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('procurement.policy.rule.name')} value={value.name} onChange={(name) => update({ name })} maxLength={160} />
        <Choice label={t('procurement.policy.rule.status')} value={value.status} options={['draft', 'active', 'archived']} onChange={(status) => update({ status })} />
        <Choice label={t('procurement.policy.rule.type')} value={value.type} options={['approval', 'requirements', 'supplier_participation']} onChange={(type) => update({ type })} />
        <Choice label={t('procurement.policy.rule.event')} value={value.event} options={['requisition', 'offer', 'publication', 'award', 'order']} onChange={(event) => update({ event })} />
      </div>
      <TextField label={t('procurement.policy.rule.descriptionLabel')} value={value.description} onChange={(description) => update({ description })} maxLength={2000} />
      <div className="grid gap-4 sm:grid-cols-2">
        <DateTimeField label={t('procurement.policy.rule.from')} value={value.effectiveFrom ?? ''}
          onChange={(effectiveFrom) => update({ effectiveFrom: effectiveFrom || null })} />
        <DateTimeField label={t('procurement.policy.rule.until')} value={value.effectiveUntil ?? ''}
          onChange={(effectiveUntil) => update({ effectiveUntil: effectiveUntil || null })} />
      </div>
      <fieldset id={`${cardId}-conditions`} className={`${policyInsetClassName} scroll-mt-36`}><legend className={policyLegendClassName}>{t('procurement.policy.rule.conditions')}</legend>
        <p className="text-sm text-muted-foreground">{t('procurement.policy.rule.conditionsDescription')}</p>
        <ReferencePicker siteId={siteId} kind="products" label={t('procurement.policy.rule.products')} ids={value.scope.productIds}
          onChange={(productIds) => update({ scope: { ...value.scope, productIds } })} />
        <ReferencePicker siteId={siteId} kind="categories" label={t('procurement.policy.rule.categories')} ids={value.scope.categoryIds}
          onChange={(categoryIds) => update({ scope: { ...value.scope, categoryIds } })} />
        <Choice label={t('procurement.policy.rule.lineMatch')} value={value.scope.lineMatch} options={['any', 'all']}
          onChange={(lineMatch) => update({ scope: { ...value.scope, lineMatch } })} />
        <ReferencePicker siteId={siteId} label={t('procurement.policy.rule.requesters')} ids={value.scope.requesterIds}
          onChange={(requesterIds) => update({ scope: { ...value.scope, requesterIds } })} />
        <ReferencePicker siteId={siteId} label={t('procurement.policy.rule.responsible')} ids={value.scope.responsibleIds}
          onChange={(responsibleIds) => update({ scope: { ...value.scope, responsibleIds } })} />
        <Toggle label={t('procurement.policy.rule.thresholdEnable')} checked={value.amount !== null}
          onChange={(enabled) => update({ amount: enabled ? { operator: 'gte', valueMinor: 0, currency: 'MXN', basis: 'document' } : null })} />
        {value.amount && <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('procurement.policy.rule.currency')} value={value.amount.currency} maxLength={3}
            onChange={(currency) => update({ amount: { ...value.amount!, currency: currency.toUpperCase() } })} />
          <Choice label={t('procurement.policy.rule.operator')} value={value.amount.operator} options={['gt', 'gte', 'lt', 'lte', 'eq', 'between']}
            onChange={(operator) => {
              const amount = { ...value.amount! };
              delete amount.maxMinor;
              update({ amount: operator === 'between' ? { ...amount, operator, maxMinor: amount.valueMinor } : { ...amount, operator } });
            }} />
          <AmountField label={t('procurement.policy.rule.amount')} currency={value.amount.currency} value={value.amount.valueMinor}
            onChange={(valueMinor) => update({ amount: { ...value.amount!, valueMinor } })} />
          {value.amount.operator === 'between' && <AmountField label={t('procurement.policy.rule.upper')} currency={value.amount.currency} value={value.amount.maxMinor ?? 0}
            onChange={(maxMinor) => update({ amount: { ...value.amount!, maxMinor } })} />}
          <Choice label={t('procurement.policy.rule.basis')} value={value.amount.basis} options={['document', 'matching_lines']}
            onChange={(basis) => update({ amount: { ...value.amount!, basis } })} />
          <p className="text-sm text-muted-foreground">{t('procurement.policy.rule.operatorsDescription')}</p>
        </div>}
      </fieldset>
      <h3 id={`${cardId}-approvals`} className="scroll-mt-36 text-sm font-semibold">{t('procurement.policy.rule.approvals')}</h3>
      <StageEditor siteId={siteId} timeZone={timeZone} stages={value.stages} onChange={(stages) => update({ stages })} />
      <h3 id={`${cardId}-requirements`} className="scroll-mt-36 text-sm font-semibold">{t('procurement.policy.rule.requirements')}</h3>
      <RequirementEditor siteId={siteId} value={value.requirements} onChange={(requirements) => update({ requirements })} />
      <Toggle label={t('procurement.policy.rule.proposalsEnable')} checked={value.minimumSupplierProposals !== null}
        onChange={(enabled) => update({ minimumSupplierProposals: enabled ? 1 : null })} />
      {value.minimumSupplierProposals !== null && <NumberField label={t('procurement.policy.rule.minimumProposals')} value={value.minimumSupplierProposals}
        onChange={(minimumSupplierProposals) => update({ minimumSupplierProposals })} />}
      </fieldset>
    </SectionCardContent>}
    <SectionCardFooter {...saveProps}>
      {onClose && expanded && <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onClose}>{t('procurement.policy.rules.done')}</Button>}
      {value.status !== 'archived' && <Button type="button" variant="outline" size="sm" disabled={disabled}
        onClick={() => update({ status: 'archived' })}>{t('procurement.policy.rules.archive', { name: value.name })}</Button>}
    </SectionCardFooter>
  </SectionCard>;
}