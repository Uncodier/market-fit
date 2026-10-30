import { useState } from 'react';
import { isDemoSiteId } from '@/lib/demo-utils';
import { Button } from '@/app/components/ui/button';
import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter } from '@/app/components/ui/section-card';
import { evaluateProcurementPolicy, type PolicyDocument, type SimulationInput, type SimulationResult } from '../domain';
import { AmountField, Choice, TextField, DateTimeField } from './form-fields';
import { ReferencePicker } from './reference-picker';
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n';
import { simulationText } from './policy-presentation';
import { policyInsetClassName, policyLegendClassName } from './policy-styles';

export function PolicySimulator({ document, siteId }: { document: PolicyDocument; siteId: string }) {
  const i18n = useProcurementI18n();
  const { t, valueLabel, formatNumber, formatDate } = i18n;
  const [input, setInput] = useState<SimulationInput>(() => ({ event: isDemoSiteId(siteId) ? 'order' : 'requisition', currency: isDemoSiteId(siteId) ? 'USD' : 'MXN', netAmountMinor: isDemoSiteId(siteId) ? 600000 : 0,
    evaluatedAt: new Date().toISOString(), lines: [] }));
  const [result, setResult] = useState<{ value: SimulationResult; fingerprint: string } | null>(null);
  const update = (patch: Partial<SimulationInput>) => setInput({ ...input, ...patch });
  const fingerprint = JSON.stringify({ document, input });
  const stale = result !== null && fingerprint !== result.fingerprint;
  return <SectionCard id="procurement-simulator" className="scroll-mt-36"><SectionCardHeader title={t('procurement.policy.simulator.title')}
    description={t('procurement.policy.simulator.description')} />
    <SectionCardContent>
      <div className="grid gap-4 sm:grid-cols-2">
        <Choice label={t('procurement.policy.simulator.event')} value={input.event} options={['requisition', 'offer', 'publication', 'award', 'order']} onChange={(event) => update({ event })} />
        <TextField label={t('procurement.policy.simulator.currency')} value={input.currency} maxLength={3} onChange={(currency) => update({ currency: currency.toUpperCase() })} />
        <AmountField label={t('procurement.policy.simulator.total')} currency={input.currency} value={input.netAmountMinor} onChange={(netAmountMinor) => update({ netAmountMinor })} />
        <DateTimeField label={t('procurement.policy.simulator.evaluatedAt')} value={input.evaluatedAt} onChange={(evaluatedAt) => update({ evaluatedAt })} />
        <DateTimeField label={t('procurement.policy.simulator.publicationAt')} value={input.publicationAt ?? ''} onChange={(publicationAt) => update({ publicationAt: publicationAt || undefined })} />
        <DateTimeField label={t('procurement.policy.simulator.stageActivatedAt')} value={input.stageActivatedAt ?? ''} onChange={(stageActivatedAt) => update({ stageActivatedAt: stageActivatedAt || undefined })} />
      </div>
      <ReferencePicker siteId={siteId} label={t('procurement.policy.simulator.requester')} single ids={input.requesterId ? [input.requesterId] : []} onChange={(ids) => update({ requesterId: ids[0] })} />
      <ReferencePicker siteId={siteId} label={t('procurement.policy.simulator.responsible')} single ids={input.responsibleId ? [input.responsibleId] : []} onChange={(ids) => update({ responsibleId: ids[0] })} />
      <p className="text-sm text-muted-foreground">{t('procurement.policy.simulator.linesDescription')}</p>
      {input.lines.map((line, index) => {
        const editLine = (patch: Partial<SimulationInput['lines'][number]>) => update({ lines: input.lines.map((item, i) => i === index ? { ...item, ...patch } : item) });
        return <fieldset key={line.id} className={policyInsetClassName}><legend className={policyLegendClassName}>{t('procurement.policy.simulator.line', { number: formatNumber(index + 1) })}</legend>
          <ReferencePicker siteId={siteId} kind="products" label={t('procurement.policy.simulator.lineProduct', { number: formatNumber(index + 1) })} single ids={line.productId ? [line.productId] : []} onChange={(ids) => editLine({ productId: ids[0] ?? null })} />
          <ReferencePicker siteId={siteId} kind="categories" label={t('procurement.policy.simulator.lineCategories', { number: formatNumber(index + 1) })} ids={line.categoryIds} onChange={(categoryIds) => editLine({ categoryIds })} />
          <AmountField label={t('procurement.policy.simulator.lineAmount', { number: formatNumber(index + 1) })} currency={input.currency} value={line.netAmountMinor} onChange={(netAmountMinor) => editLine({ netAmountMinor })} />
          <Button type="button" variant="outline" onClick={() => update({ lines: input.lines.filter((_, i) => i !== index) })}>{t('procurement.policy.simulator.removeLine', { number: formatNumber(index + 1) })}</Button>
        </fieldset>;
      })}
      {result && <div role="status" className={`${policyInsetClassName} text-sm leading-relaxed`}>
        {stale && <p className="font-medium">{t('procurement.policy.simulator.stale')}</p>}
        <h3 className="font-semibold">{t(result.value.status === 'ready' ? 'procurement.policy.simulator.ready' : 'procurement.policy.simulator.blocked')}</h3>
        <p>{t('procurement.policy.simulator.sourceCounting', { source: t(`procurement.policy.simulator.source.${result.value.source}`), counting: valueLabel(result.value.crossRuleCounting) })}</p>
        <p>{t('procurement.policy.simulator.matched', { names: result.value.matchedRuleIds.map((id) => document.rules.find((rule) => rule.id === id)?.name ?? id).join(', ') || t('procurement.policy.simulator.none') })}</p>
        {result.value.issues.length > 0 && <ul className="list-disc pl-5 text-destructive">{result.value.issues.map((issue, i) => <li key={i}>{simulationText(issue, i18n)}</li>)}</ul>}
        <ul className="list-disc pl-5">{result.value.explanations.map((explanation, i) => <li key={i}>{simulationText(explanation, i18n)}</li>)}</ul>
        {result.value.stages.map((stage, i) => <p key={`${stage.id}-${i}`}>{t('procurement.policy.simulator.stageSummary', {
          name: stage.name, decision: valueLabel(stage.decisionMode), quorum: stage.quorum.mode === 'n_of_m' ? t('procurement.policy.simulator.quorum', { count: formatNumber(stage.quorum.count), total: formatNumber(stage.approverIds.length) }) : valueLabel(stage.quorum.mode),
          deadline: stage.resolvedDeadline ? formatDate(stage.resolvedDeadline, { dateStyle: 'medium', timeStyle: 'short', timeZone: stage.deadline?.timeZone ?? document.settings.timeZone }) : t('procurement.policy.simulator.unresolved'), source: stage.sourceRuleId ?? t('procurement.policy.simulator.generalFallback'),
        })}</p>)}
        {result.value.requirements.map((requirement) => <p key={requirement.id}>{t('procurement.policy.simulator.requirementSummary', { name: requirement.name, classification: valueLabel(requirement.classification), kind: valueLabel(requirement.kind), milestone: valueLabel(requirement.milestone) })}</p>)}
        {result.value.minimumSupplierProposals !== null && <p>{t('procurement.policy.simulator.minimum', { number: formatNumber(result.value.minimumSupplierProposals) })}</p>}
      </div>}
    </SectionCardContent>
      <SectionCardFooter className="flex-wrap"><Button type="button" variant="outline" size="sm" disabled={input.lines.length >= 1000}
        onClick={() => update({ lines: [...input.lines, { id: crypto.randomUUID(), productId: null, categoryIds: [], netAmountMinor: 0 }] })}>{t('procurement.policy.simulator.addLine')}</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setResult({ value: evaluateProcurementPolicy(document, input), fingerprint })}>{t('procurement.policy.simulator.run')}</Button></SectionCardFooter>

  </SectionCard>;
}