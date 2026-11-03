'use client'

import { useEffect, useRef, useState } from 'react'
import type { ZodIssue } from 'zod'
import { Button } from '@/app/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogForm } from '@/app/components/ui/dialog'
import { WorkflowValidation } from '@/app/purchases/requests/workflow-validation'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { ReferencePicker } from '../components/reference-picker'
import { Choice, NumberField, TextField, Toggle } from '../components/form-fields'
import { isProcurementDemo } from '../ui/is-demo'
import { replenishmentDocumentSchema, type ReplenishmentDocument, type ReplenishmentRule } from './schema'

export type ReplenishmentRuleDialogProps = {
  siteId: string
  rule: ReplenishmentRule | 'new' | null
  onClose: () => void
  onSaved: () => void
  demo?: boolean
}

const initial: ReplenishmentDocument = { name: '', catalog_item_id: '', location_id: '', minimum: 10, target: 40, minimum_order: 1, order_multiple: 1, action: 'draft', enabled: false }

export function ReplenishmentRuleDialog(props: ReplenishmentRuleDialogProps) {
  if (props.rule === null) return null
  const key = `${props.siteId}:${props.rule === 'new' ? 'new' : `${props.rule.id}:${props.rule.version}`}`
  return <RuleEditor key={key} {...props} rule={props.rule} />
}

export { ReplenishmentRuleDialog as RuleDialog }

function RuleEditor({ siteId, rule, onClose, onSaved, demo = isProcurementDemo(siteId) }: Omit<ReplenishmentRuleDialogProps, 'rule'> & { rule: ReplenishmentRule | 'new' }) {
  const { t, message } = useProcurementI18n()
  const [draft, setDraft] = useState<ReplenishmentDocument>(() => rule === 'new' ? { ...initial } : {
    name: rule.name, catalog_item_id: rule.catalog_item_id, location_id: rule.location_id,
    minimum: rule.minimum, target: rule.target, minimum_order: rule.minimum_order,
    order_multiple: rule.order_multiple, action: rule.action, enabled: rule.enabled,
  })
  const [issues, setIssues] = useState<ZodIssue[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  async function save() {
    if (demo || saving.current) return
    const parsed = replenishmentDocumentSchema.safeParse(draft)
    if (!parsed.success) { setIssues(parsed.error.issues); return }
    saving.current = true
    setIssues([]); setBusy(true); setError('')
    try {
      const response = await fetch(`/api/procurement/replenishment?site_id=${siteId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule === 'new' ? null : rule.id, expected_version: rule === 'new' ? 0 : rule.version, document: parsed.data }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      if (mounted.current) { onClose(); onSaved() }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Unable to save')
    } finally {
      saving.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving.current) onClose() }}>
    <DialogContent closeLabel={t('procurement.navigation.closeDialog')} size="lg" busy={busy}>
      <DialogHeader><DialogTitle>{t('procurement.workflow.replenishment.ruleTitle')}</DialogTitle><DialogDescription>{t('procurement.workflow.replenishment.editorDescription')}</DialogDescription></DialogHeader>
      <DialogForm onSubmit={event => { event.preventDefault(); void save() }}>
        <DialogBody className="space-y-4"><fieldset disabled={busy} className="space-y-4">
          {error && <p role="alert" className="text-sm text-destructive">{message(error)}</p>}
          <WorkflowValidation issues={issues} kind="replenishment" />
          <TextField label={t('procurement.workflow.replenishment.ruleName')} value={draft.name} onChange={name => setDraft({ ...draft, name })} />
          <ReferencePicker siteId={siteId} kind="products" label={t('procurement.workflow.replenishment.stockSku')} single disabled={busy || rule !== 'new'} ids={draft.catalog_item_id ? [draft.catalog_item_id] : []} onChange={ids => setDraft({ ...draft, catalog_item_id: ids[0] ?? '' })} />
          <ReferencePicker siteId={siteId} kind="locations" label={t('procurement.workflow.replenishment.stockLocation')} single disabled={busy || rule !== 'new'} ids={draft.location_id ? [draft.location_id] : []} onChange={ids => setDraft({ ...draft, location_id: ids[0] ?? '' })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label={t('procurement.workflow.replenishment.minimumStock')} min={0} value={draft.minimum} onChange={minimum => setDraft({ ...draft, minimum })} />
            <NumberField label={t('procurement.workflow.replenishment.targetStock')} value={draft.target} onChange={target => setDraft({ ...draft, target })} />
            <NumberField label={t('procurement.workflow.replenishment.minimumPurchase')} value={draft.minimum_order} onChange={minimum_order => setDraft({ ...draft, minimum_order })} />
            <NumberField label={t('procurement.workflow.replenishment.purchaseMultiple')} value={draft.order_multiple} onChange={order_multiple => setDraft({ ...draft, order_multiple })} />
          </div>
          <Choice label={t('procurement.workflow.replenishment.action')} value={draft.action} options={['alert', 'draft']} disabled={busy} onChange={action => setDraft({ ...draft, action })} />
          <Toggle label={t('procurement.workflow.replenishment.enabled')} checked={draft.enabled} onChange={enabled => setDraft({ ...draft, enabled })} />
        </fieldset></DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => { if (!saving.current) onClose() }}>{t('procurement.workflow.common.cancel')}</Button>
          <Button type="submit" disabled={demo || busy}>{t('procurement.workflow.replenishment.save')}</Button>
        </DialogFooter>
      </DialogForm>
    </DialogContent>
  </Dialog>
}