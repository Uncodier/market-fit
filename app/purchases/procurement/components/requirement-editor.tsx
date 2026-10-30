import { Button } from '@/app/components/ui/button';
import type { ProcurementRequirement } from '../domain';
import { Choice, TextField, Toggle } from './form-fields';
import { ReferencePicker } from './reference-picker';
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n';
import { policyInsetClassName, policyLegendClassName } from './policy-styles';

export function RequirementEditor({ value, onChange, siteId }: {
  value: ProcurementRequirement[]; onChange: (value: ProcurementRequirement[]) => void; siteId: string;
}) {
  const { t, formatNumber } = useProcurementI18n();
  return <div className="space-y-4">
    {value.map((requirement, index) => {
      const update = (patch: Partial<ProcurementRequirement>) => onChange(value.map((item, i) => i === index ? { ...item, ...patch } : item));
      return <fieldset key={requirement.id} className={policyInsetClassName}>
        <legend className={policyLegendClassName}>{t('procurement.policy.requirement.number', { number: formatNumber(index + 1) })}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('procurement.policy.requirement.name')} value={requirement.name} onChange={(name) => update({ name })} maxLength={200} />
          <Choice label={t('procurement.policy.requirement.kind')} value={requirement.kind} options={['technical', 'document', 'certification']}
            onChange={(kind) => update({ kind, credential: kind === 'certification' ? {
              holder: 'organization', validity: 'submission', acceptedEquivalentIds: [], evidenceRequired: true, review: 'human',
            } : null })} />
          <Choice label={t('procurement.policy.requirement.classification')} value={requirement.classification} options={['mandatory', 'scored']} onChange={(classification) => update({ classification })} />
          <Choice label={t('procurement.policy.requirement.milestone')} value={requirement.milestone} options={['participation', 'evaluation', 'award', 'order', 'receipt']}
            onChange={(milestone) => update({ milestone })} />
        </div>
        <Toggle label={t('procurement.policy.requirement.exception')} checked={requirement.overridable} onChange={(overridable) => update({ overridable })} />
        <ReferencePicker siteId={siteId} kind="products" label={t('procurement.policy.requirement.products')} ids={requirement.productIds} onChange={(productIds) => update({ productIds })} />
        <ReferencePicker siteId={siteId} kind="categories" label={t('procurement.policy.requirement.categories')} ids={requirement.categoryIds} onChange={(categoryIds) => update({ categoryIds })} />
        {requirement.credential && <div className="space-y-4">
          <Choice label={t('procurement.policy.requirement.holder')} value={requirement.credential.holder} options={['person', 'organization']}
            onChange={(holder) => update({ credential: { ...requirement.credential!, holder } })} />
          <Choice label={t('procurement.policy.requirement.validity')} value={requirement.credential.validity} options={['submission', 'award', 'contract_period']}
            onChange={(validity) => update({ credential: { ...requirement.credential!, validity } })} />
          <Choice label={t('procurement.policy.requirement.review')} value={requirement.credential.review} options={['human', 'ai_assisted']}
            onChange={(review) => update({ credential: { ...requirement.credential!, review } })} />
          <Toggle label={t('procurement.policy.requirement.evidence')} checked={requirement.credential.evidenceRequired}
            onChange={(evidenceRequired) => update({ credential: { ...requirement.credential!, evidenceRequired } })} />
          <p className="text-sm text-muted-foreground">{t('procurement.policy.requirement.description')}</p>
        </div>}
        <Button type="button" variant="outline" onClick={() => onChange(value.filter((_, i) => i !== index))}>{t('procurement.policy.requirement.remove', { number: formatNumber(index + 1) })}</Button>
      </fieldset>;
    })}
    <Button type="button" variant="outline" disabled={value.length >= 200} onClick={() => onChange([...value, {
      id: crypto.randomUUID(), name: '', kind: 'certification', classification: 'mandatory', milestone: 'participation',
      overridable: false, productIds: [], categoryIds: [], credential: { holder: 'organization', validity: 'submission',
        acceptedEquivalentIds: [], evidenceRequired: true, review: 'human' },
    }])}>{t('procurement.policy.requirement.add')}</Button>
  </div>;
}