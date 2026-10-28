import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { SectionCard, SectionCardHeader, SectionCardContent } from '@/app/components/ui/section-card';
import { evaluateProcurementPolicy, type PolicyDocument, type SimulationInput, type SimulationResult } from '../domain';
import { AmountField, Choice, TextField, DateTimeField, humanize } from './form-fields';
import { ReferencePicker } from './reference-picker';

export function PolicySimulator({ document, siteId }: { document: PolicyDocument; siteId: string }) {
  const [input, setInput] = useState<SimulationInput>(() => ({ event: 'requisition', currency: 'MXN', netAmountMinor: 0,
    evaluatedAt: new Date().toISOString(), lines: [] }));
  const [result, setResult] = useState<{ value: SimulationResult; fingerprint: string } | null>(null);
  const update = (patch: Partial<SimulationInput>) => setInput({ ...input, ...patch });
  const fingerprint = JSON.stringify({ document, input });
  const stale = result !== null && fingerprint !== result.fingerprint;
  return <SectionCard><SectionCardHeader title="Policy simulator — simulation only"
    description="Evaluates the current draft, including unsaved edits. It never approves, publishes, orders, pays, verifies evidence or runs AI. Ready means a plan can be described, not authorization." />
    <SectionCardContent>
      <div className="grid gap-4 sm:grid-cols-2">
        <Choice label="Simulated event" value={input.event} options={['requisition', 'offer', 'publication', 'award', 'order']} onChange={(event) => update({ event })} />
        <TextField label="Simulation currency" value={input.currency} maxLength={3} onChange={(currency) => update({ currency: currency.toUpperCase() })} />
        <AmountField label="Document total" currency={input.currency} value={input.netAmountMinor} onChange={(netAmountMinor) => update({ netAmountMinor })} />
        <DateTimeField label="Evaluation time" value={input.evaluatedAt} onChange={(evaluatedAt) => update({ evaluatedAt })} />
        <DateTimeField label="Publication time (optional)" value={input.publicationAt ?? ''} onChange={(publicationAt) => update({ publicationAt: publicationAt || undefined })} />
        <DateTimeField label="Stage activation time (optional)" value={input.stageActivatedAt ?? ''} onChange={(stageActivatedAt) => update({ stageActivatedAt: stageActivatedAt || undefined })} />
      </div>
      <ReferencePicker siteId={siteId} label="Simulated requester" single ids={input.requesterId ? [input.requesterId] : []} onChange={(ids) => update({ requesterId: ids[0] })} />
      <ReferencePicker siteId={siteId} label="Simulated responsible person" single ids={input.responsibleId ? [input.responsibleId] : []} onChange={(ids) => update({ responsibleId: ids[0] })} />
      <p className="text-sm text-muted-foreground">For product/category or matching-line rules, add lines. Their net amounts must equal the document total. No FX conversion is performed.</p>
      {input.lines.map((line, index) => {
        const editLine = (patch: Partial<SimulationInput['lines'][number]>) => update({ lines: input.lines.map((item, i) => i === index ? { ...item, ...patch } : item) });
        return <fieldset key={line.id} className="space-y-3 rounded-lg border p-4"><legend>Simulation line {index + 1}</legend>
          <ReferencePicker siteId={siteId} kind="products" label={`Line ${index + 1} product`} single ids={line.productId ? [line.productId] : []} onChange={(ids) => editLine({ productId: ids[0] ?? null })} />
          <ReferencePicker siteId={siteId} kind="categories" label={`Line ${index + 1} categories`} ids={line.categoryIds} onChange={(categoryIds) => editLine({ categoryIds })} />
          <AmountField label={`Line ${index + 1} amount`} currency={input.currency} value={line.netAmountMinor} onChange={(netAmountMinor) => editLine({ netAmountMinor })} />
          <Button type="button" variant="outline" onClick={() => update({ lines: input.lines.filter((_, i) => i !== index) })}>Remove line {index + 1}</Button>
        </fieldset>;
      })}
      <div className="flex gap-3"><Button type="button" variant="outline" disabled={input.lines.length >= 1000}
        onClick={() => update({ lines: [...input.lines, { id: crypto.randomUUID(), productId: null, categoryIds: [], netAmountMinor: 0 }] })}>Add simulation line</Button>
        <Button type="button" onClick={() => setResult({ value: evaluateProcurementPolicy(document, input), fingerprint })}>Run simulation</Button></div>
      {result && <div role="status" className="space-y-3 rounded-lg border p-4">
        {stale && <p className="font-medium">Inputs or policy changed. Run the simulation again; the result below is stale.</p>}
        <h3 className="font-semibold">Simulation only: {result.value.status === 'ready' ? 'Plan ready — not approved' : 'Blocked / missing inputs'}</h3>
        <p>Source: {humanize(result.value.source)}. Cross-rule counting: {humanize(result.value.crossRuleCounting)}.</p>
        <p>Matched rules: {result.value.matchedRuleIds.map((id) => document.rules.find((rule) => rule.id === id)?.name ?? id).join(', ') || 'None'}.</p>
        {result.value.issues.length > 0 && <ul className="list-disc pl-5 text-destructive">{result.value.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
        <ul className="list-disc pl-5">{result.value.explanations.map((explanation, i) => <li key={i}>{explanation}</li>)}</ul>
        {result.value.stages.map((stage, i) => <p key={`${stage.id}-${i}`}>{stage.name}: {humanize(stage.decisionMode)}, {stage.quorum.mode === 'n_of_m' ? `${stage.quorum.count} of ${stage.approverIds.length}` : humanize(stage.quorum.mode)}; deadline: {stage.resolvedDeadline ?? 'None / unresolved'}; source: {stage.sourceRuleId ?? 'General fallback'}.</p>)}
        {result.value.requirements.map((requirement) => <p key={requirement.id}>{requirement.name}: {humanize(requirement.classification)} {humanize(requirement.kind)}, {humanize(requirement.milestone)}.</p>)}
        {result.value.minimumSupplierProposals !== null && <p>Minimum supplier proposals: {result.value.minimumSupplierProposals} (not internal approvals).</p>}
      </div>}
    </SectionCardContent>
  </SectionCard>;
}