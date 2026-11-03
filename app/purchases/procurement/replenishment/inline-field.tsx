'use client'

import { useId, useRef, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { Check, X } from '@/app/components/ui/icons'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { replenishmentDocumentSchema, type ReplenishmentDocument, type ReplenishmentRule } from './schema'

export type EditableRuleField = 'name' | 'minimum' | 'target' | 'minimum_order' | 'order_multiple' | 'action' | 'enabled'
export type SaveRuleField = (field: EditableRuleField, value: string | number | boolean, version: number) => Promise<void>

export function ruleDocument(rule: ReplenishmentRule): ReplenishmentDocument {
  return { name: rule.name, catalog_item_id: rule.catalog_item_id, location_id: rule.location_id,
    minimum: rule.minimum, target: rule.target, minimum_order: rule.minimum_order, order_multiple: rule.order_multiple,
    action: rule.action, enabled: rule.enabled }
}

/** Same explicit check/cancel interaction as Lead property rows, with localized controls. */
export function RuleInlineField({ rule, field, label, display, disabled, onSave, identity = false }: {
  rule: ReplenishmentRule; field: EditableRuleField; label: string; display: string; disabled: boolean; onSave: SaveRuleField; identity?: boolean
}) {
  const { t, message } = useProcurementI18n()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [version, setVersion] = useState(rule.version)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const errorId = useId()
  const numeric = ['minimum', 'target', 'minimum_order', 'order_multiple'].includes(field)
  const value = numeric ? Number(draft) : field === 'enabled' ? draft === 'true' : draft.trim()
  const parsed = replenishmentDocumentSchema.safeParse({ ...ruleDocument(rule), [field]: value })
  const validation = editing ? numeric && !draft.trim() ? t('procurement.errors.requiredField')
    : !parsed.success ? message(parsed.error.issues[0].message) : '' : ''
  const options = field === 'action' ? [
    { value: 'alert', label: t('procurement.workflow.replenishment.recordAlert') },
    { value: 'draft', label: t('procurement.workflow.replenishment.createDraft') },
  ] : field === 'enabled' ? [
    { value: 'true', label: t('procurement.workflow.replenishment.enabled') },
    { value: 'false', label: t('procurement.workflow.replenishment.disabled') },
  ] : null

  function cancel() {
    if (lock.current) return
    setEditing(false); setError('')
    requestAnimationFrame(() => trigger.current?.focus())
  }
  async function save() {
    if (disabled || lock.current || validation) return
    if (value === rule[field]) { cancel(); return }
    lock.current = true; setSaving(true); setError('')
    try {
      await onSave(field, value, version)
      setEditing(false)
      requestAnimationFrame(() => trigger.current?.focus())
    } catch (failure) { setError(failure instanceof Error ? message(failure.message) : t('procurement.common.unknownError')) }
    finally { lock.current = false; setSaving(false) }
  }

  return <div className="min-w-0">
    {editing ? <div className="flex min-w-0 items-start gap-1" onKeyDown={event => {
      if (event.nativeEvent.isComposing) return
      if (event.key === 'Escape') { event.preventDefault(); cancel() }
      if (!options && event.key === 'Enter') { event.preventDefault(); void save() }
    }}>
      <div className="min-w-0 flex-1">{options ? <Select value={draft} onValueChange={next => { setDraft(next); setError('') }} disabled={saving || disabled}>
        <SelectTrigger autoFocus aria-label={label} className="h-8 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select> : <Input autoFocus aria-label={label} value={draft} disabled={saving || disabled} type={numeric ? 'number' : 'text'}
        min={numeric ? field === 'minimum' || field === 'target' ? 0 : 1 : undefined} max={numeric ? 1000000 : undefined}
        step={numeric ? field === 'minimum' || field === 'target' ? 'any' : 1 : undefined} maxLength={field === 'name' ? 200 : undefined}
        aria-invalid={!!validation || !!error} aria-describedby={validation || error ? errorId : undefined}
        className={identity ? 'h-8 text-xl font-semibold' : 'h-8 text-sm'} onChange={event => { setDraft(event.target.value); setError('') }} />}</div>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" disabled={saving || disabled || !!validation}
        aria-label={t('procurement.workflow.replenishment.saveField', { field: label })} onClick={() => void save()}><Check className="h-3.5 w-3.5" /></Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" disabled={saving}
        aria-label={t('procurement.workflow.replenishment.cancelField', { field: label })} onClick={cancel}><X className="h-3.5 w-3.5" /></Button>
    </div> : <button type="button" ref={trigger} disabled={disabled} aria-label={t('procurement.workflow.replenishment.editField', { field: label })}
      title={display} className={`-mx-1 block max-w-full rounded-md px-1 py-0.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:cursor-text enabled:hover:bg-muted/60 ${identity ? 'text-xl font-semibold leading-tight' : 'text-sm'}`}
      onClick={() => { setDraft(String(rule[field])); setVersion(rule.version); setError(''); setEditing(true) }}>{display}</button>}
    {editing && (validation || error) && <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">{validation || error}</p>}
  </div>
}