import { useId, useState } from 'react'
import { isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'
import { demoProcurementReferences } from '@/lib/demo-data/procurement-suppliers'
import { Button } from '@/app/components/ui/button'
import { Label } from '@/app/components/ui/label'
import { ChevronDown } from '@/app/components/ui/icons'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/app/components/ui/command'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { useProcurementOptions } from './use-procurement-options'
import { readChoices, useReferenceBrowse } from './reference-options'

type Option = { id: string; label: string }
type Props = {
  siteId: string; kind?: 'people' | 'products' | 'categories' | 'agents' | 'locations'; label: string
  ids: string[]; onChange: (ids: string[]) => void; single?: boolean; disabled?: boolean
}

export function ReferencePicker(props: Props) {
  const demo = isDemoSiteId(props.siteId)
  const blocked = !demo && isDemoModeActive()
  return <ScopedPicker key={`${props.siteId}:${props.kind ?? 'people'}:${blocked}`} {...props} demo={demo} blocked={blocked} disabled={props.disabled || blocked} />
}

function ScopedPicker({ siteId, kind = 'people', label, ids, onChange, single, disabled, demo, blocked }: Props & { demo: boolean; blocked: boolean }) {
  const { t, message } = useProcurementI18n()
  const triggerId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [labels, setLabels] = useState<Record<string, string>>({})
  if (disabled && open) setOpen(false)
  const readBrowse = useReferenceBrowse()
  const needsNames = ids.some(id => !labels[id])
  const search = query.trim().slice(0, 100)
  const url = (q: string) => `/api/procurement/references?${new URLSearchParams({ site_id: siteId, kind, q })}`
  const browse = useProcurementOptions(!blocked && !demo && (needsNames || (open && !search)) ? url('') : null, readBrowse, 200)
  const searched = useProcurementOptions(!blocked && !demo && open && search ? url(search) : null, readChoices, 200)
  const { data, error, loading, retry } = search ? searched : browse
  const fixtures = demo ? demoProcurementReferences[kind] : []
  const options = (demo ? fixtures.filter(item => item.label.toLowerCase().includes(query.toLowerCase())) : data?.options ?? [])
    .filter(item => !ids.includes(item.id))

  function select(item: Option) {
    if (disabled) return
    setLabels(previous => ({ ...previous, [item.id]: item.label }))
    onChange(single ? [item.id] : [...ids, item.id])
    setOpen(false)
  }
  return <div className="space-y-2">
    <Label htmlFor={triggerId}>{label}</Label>
    <Popover open={open} onOpenChange={next => { if (!disabled) { setQuery(''); setOpen(next) } }}>
      <PopoverTrigger asChild><Button id={triggerId} type="button" variant="outline" disabled={disabled} aria-label={label}
        className="w-full justify-between font-normal text-muted-foreground"><span className="truncate">{t('procurement.common.searchFor', { label })}</span><ChevronDown className="h-4 w-4 shrink-0" /></Button></PopoverTrigger>
      {open && <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false} label={label}>
          <CommandInput value={query} onValueChange={setQuery} maxLength={100} placeholder={t('procurement.common.search')} />
          <CommandList>
            {loading ? <p role="status" className="p-3 text-sm">{t('procurement.common.loadingChoices')}</p>
              : error ? <div role="alert" className="p-3 text-sm text-destructive">{message(error)} <Button type="button" size="sm" variant="outline" onClick={retry}>{t('procurement.common.retry')}</Button></div>
              : options.length ? <CommandGroup>{options.map(item => <CommandItem key={item.id} value={item.id} data-relation-id={item.id}
                className="data-[disabled=false]:!pointer-events-auto data-[disabled=false]:!opacity-100" onSelect={() => select(item)}>{item.label}</CommandItem>)}</CommandGroup>
              : <p className="p-3 text-sm text-muted-foreground">{t('procurement.common.noChoices')}</p>}
          </CommandList>
          {data?.has_more && <p className="px-3 py-2 text-xs text-muted-foreground">{t('procurement.common.moreChoices')}</p>}
        </Command>
      </PopoverContent>}
    </Popover>
    <div className="flex flex-wrap gap-2">{ids.map(id => {
      const name = labels[id] ?? (demo ? fixtures : browse.data?.options)?.find(item => item.id === id)?.label
      return <Button disabled={disabled} key={id} type="button" variant="outline" size="sm" aria-label={t('procurement.common.removeReference', { name: name ?? id, label })}
        onClick={() => onChange(ids.filter(value => value !== id))}>{name ?? t('procurement.common.savedReference', { id })} ×</Button>
    })}</div>
    {!open && browse.error && <p role="alert" className="text-sm text-destructive">{message(browse.error)}</p>}
  </div>
}