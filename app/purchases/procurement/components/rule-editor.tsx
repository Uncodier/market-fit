import { SectionCard, SectionCardHeader, SectionCardContent } from '@/app/components/ui/section-card';
import { Button } from '@/app/components/ui/button';
import type { ProcurementRule } from '../domain';
import { AmountField, Choice, NumberField, TextField, Toggle, DateTimeField } from './form-fields';
import { ReferencePicker } from './reference-picker';
import { StageEditor } from './stage-editor';
import { RequirementEditor } from './requirement-editor';

export function RuleEditor({ value, onChange, onClose, siteId, timeZone }: {
  value: ProcurementRule; onChange: (rule: ProcurementRule) => void; onClose: () => void; siteId: string; timeZone: string;
}) {
  const update = (patch: Partial<ProcurementRule>) => onChange({ ...value, ...patch });
  return <SectionCard><SectionCardHeader title={value.name || 'New rule'} description="Edits are part of the workspace draft. Use Save policy to persist changes."
    actions={<Button type="button" variant="outline" onClick={onClose}>Close editor</Button>} />
    <SectionCardContent>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Rule name" value={value.name} onChange={(name) => update({ name })} maxLength={160} />
        <Choice label="Rule status" value={value.status} options={['draft', 'active', 'archived']} onChange={(status) => update({ status })} />
        <Choice label="Rule type" value={value.type} options={['approval', 'requirements', 'supplier_participation']} onChange={(type) => update({ type })} />
        <Choice label="Procurement event" value={value.event} options={['requisition', 'offer', 'publication', 'award', 'order']} onChange={(event) => update({ event })} />
      </div>
      <TextField label="Rule description" value={value.description} onChange={(description) => update({ description })} maxLength={2000} />
      <div className="grid gap-4 sm:grid-cols-2">
        <DateTimeField label="Effective from" value={value.effectiveFrom ?? ''}
          onChange={(effectiveFrom) => update({ effectiveFrom: effectiveFrom || null })} />
        <DateTimeField label="Effective until" value={value.effectiveUntil ?? ''}
          onChange={(effectiveUntil) => update({ effectiveUntil: effectiveUntil || null })} />
      </div>
      <fieldset className="space-y-4 rounded-lg border p-4"><legend className="px-1 font-medium">Conditions</legend>
        <p className="text-sm text-muted-foreground">Empty scopes match all. Requirements from matching active rules accumulate; requisition and offer events are separate.</p>
        <ReferencePicker siteId={siteId} kind="products" label="Matching products" ids={value.scope.productIds}
          onChange={(productIds) => update({ scope: { ...value.scope, productIds } })} />
        <ReferencePicker siteId={siteId} kind="categories" label="Matching categories" ids={value.scope.categoryIds}
          onChange={(categoryIds) => update({ scope: { ...value.scope, categoryIds } })} />
        <Choice label="Line matching" value={value.scope.lineMatch} options={['any', 'all']}
          onChange={(lineMatch) => update({ scope: { ...value.scope, lineMatch } })} />
        <ReferencePicker siteId={siteId} label="Requesters" ids={value.scope.requesterIds}
          onChange={(requesterIds) => update({ scope: { ...value.scope, requesterIds } })} />
        <ReferencePicker siteId={siteId} label="Responsible people" ids={value.scope.responsibleIds}
          onChange={(responsibleIds) => update({ scope: { ...value.scope, responsibleIds } })} />
        <Toggle label="Apply a net amount threshold" checked={value.amount !== null}
          onChange={(enabled) => update({ amount: enabled ? { operator: 'gte', valueMinor: 0, currency: 'MXN', basis: 'document' } : null })} />
        {value.amount && <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Threshold currency (ISO code)" value={value.amount.currency} maxLength={3}
            onChange={(currency) => update({ amount: { ...value.amount!, currency: currency.toUpperCase() } })} />
          <Choice label="Threshold operator" value={value.amount.operator} options={['gt', 'gte', 'lt', 'lte', 'eq', 'between']}
            onChange={(operator) => {
              const amount = { ...value.amount! };
              delete amount.maxMinor;
              update({ amount: operator === 'between' ? { ...amount, operator, maxMinor: amount.valueMinor } : { ...amount, operator } });
            }} />
          <AmountField label="Threshold amount" currency={value.amount.currency} value={value.amount.valueMinor}
            onChange={(valueMinor) => update({ amount: { ...value.amount!, valueMinor } })} />
          {value.amount.operator === 'between' && <AmountField label="Upper threshold (inclusive)" currency={value.amount.currency} value={value.amount.maxMinor ?? 0}
            onChange={(maxMinor) => update({ amount: { ...value.amount!, maxMinor } })} />}
          <Choice label="Net amount basis" value={value.amount.basis} options={['document', 'matching_lines']}
            onChange={(basis) => update({ amount: { ...value.amount!, basis } })} />
          <p className="text-sm text-muted-foreground">Gt: greater than; Gte: at least; Lt: less than; Lte: at most; Eq: equal; Between: inclusive. No currency conversion is assumed.</p>
        </div>}
      </fieldset>
      <h3 className="font-semibold">Approval requirements</h3>
      <StageEditor siteId={siteId} timeZone={timeZone} stages={value.stages} onChange={(stages) => update({ stages })} />
      <h3 className="font-semibold">Technical, document and certification requirements</h3>
      <RequirementEditor siteId={siteId} value={value.requirements} onChange={(requirements) => update({ requirements })} />
      <Toggle label="Require minimum supplier proposals" checked={value.minimumSupplierProposals !== null}
        onChange={(enabled) => update({ minimumSupplierProposals: enabled ? 1 : null })} />
      {value.minimumSupplierProposals !== null && <NumberField label="Minimum supplier proposals (not internal approvals)" value={value.minimumSupplierProposals}
        onChange={(minimumSupplierProposals) => update({ minimumSupplierProposals })} />}
    </SectionCardContent>
  </SectionCard>;
}