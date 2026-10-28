import { Button } from '@/app/components/ui/button';
import type { ProcurementRequirement } from '../domain';
import { Choice, TextField, Toggle } from './form-fields';
import { ReferencePicker } from './reference-picker';

export function RequirementEditor({ value, onChange, siteId }: {
  value: ProcurementRequirement[]; onChange: (value: ProcurementRequirement[]) => void; siteId: string;
}) {
  return <div className="space-y-4">
    {value.map((requirement, index) => {
      const update = (patch: Partial<ProcurementRequirement>) => onChange(value.map((item, i) => i === index ? { ...item, ...patch } : item));
      return <fieldset key={requirement.id} className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 font-medium">Requirement {index + 1}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Requirement name / standard" value={requirement.name} onChange={(name) => update({ name })} maxLength={200} />
          <Choice label="Requirement kind" value={requirement.kind} options={['technical', 'document', 'certification']}
            onChange={(kind) => update({ kind, credential: kind === 'certification' ? {
              holder: 'organization', validity: 'submission', acceptedEquivalentIds: [], evidenceRequired: true, review: 'human',
            } : null })} />
          <Choice label="Classification" value={requirement.classification} options={['mandatory', 'scored']} onChange={(classification) => update({ classification })} />
          <Choice label="Enforcement milestone" value={requirement.milestone} options={['participation', 'evaluation', 'award', 'order', 'receipt']}
            onChange={(milestone) => update({ milestone })} />
        </div>
        <Toggle label="Allow authorized exception" checked={requirement.overridable} onChange={(overridable) => update({ overridable })} />
        <ReferencePicker siteId={siteId} kind="products" label="Requirement products" ids={requirement.productIds} onChange={(productIds) => update({ productIds })} />
        <ReferencePicker siteId={siteId} kind="categories" label="Requirement categories" ids={requirement.categoryIds} onChange={(categoryIds) => update({ categoryIds })} />
        {requirement.credential && <div className="space-y-4">
          <Choice label="Credential holder" value={requirement.credential.holder} options={['person', 'organization']}
            onChange={(holder) => update({ credential: { ...requirement.credential!, holder } })} />
          <Choice label="Credential validity" value={requirement.credential.validity} options={['submission', 'award', 'contract_period']}
            onChange={(validity) => update({ credential: { ...requirement.credential!, validity } })} />
          <Choice label="Credential review" value={requirement.credential.review} options={['human', 'ai_assisted']}
            onChange={(review) => update({ credential: { ...requirement.credential!, review } })} />
          <Toggle label="Evidence required" checked={requirement.credential.evidenceRequired}
            onChange={(evidenceRequired) => update({ credential: { ...requirement.credential!, evidenceRequired } })} />
          <p className="text-sm text-muted-foreground">This defines a requirement; it does not verify a credential, collect evidence or run an AI review.</p>
        </div>}
        <Button type="button" variant="outline" onClick={() => onChange(value.filter((_, i) => i !== index))}>Remove requirement {index + 1}</Button>
      </fieldset>;
    })}
    <Button type="button" variant="outline" disabled={value.length >= 200} onClick={() => onChange([...value, {
      id: crypto.randomUUID(), name: '', kind: 'certification', classification: 'mandatory', milestone: 'participation',
      overridable: false, productIds: [], categoryIds: [], credential: { holder: 'organization', validity: 'submission',
        acceptedEquivalentIds: [], evidenceRequired: true, review: 'human' },
    }])}>Add requirement</Button>
  </div>;
}