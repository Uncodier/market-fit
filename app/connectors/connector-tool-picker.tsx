"use client"

import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { PlusCircle, X } from "@/app/components/ui/icons"
import { ToolCatalogSearch } from "./tool-catalog-search"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"

export function ConnectorToolPicker({ siteId, slug, selected, onChange, canManage, disabled }: {
  siteId: string; slug: string; selected: string[]; onChange: (ids: string[]) => void; canManage: boolean; disabled: boolean
}) {
  const { t } = useLocalization()
  const [open, setOpen] = useState(false)
  return <div className="space-y-2">
    <div className="flex w-full items-center justify-between gap-3"><h4 className="text-sm font-medium">{t("connectors.exactTools")}</h4>
      {canManage && <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button type="button" variant="outline" size="sm" className="shrink-0" disabled={disabled}><PlusCircle className="mr-2 h-4 w-4" />{t("connectors.addTool")}</Button></PopoverTrigger>
        <PopoverContent align="end" className="flex max-h-[var(--radix-popover-content-available-height)] w-[28rem] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-xl p-0" aria-label={t("connectors.addTool")}>
          {selected.length >= 100 ? <p role="status" className="p-2 text-sm">{t("connectors.toolLimitReached")}</p> : open && !disabled &&
            <ToolCatalogSearch siteId={siteId} slug={slug} selected={selected} onSelect={id => { onChange([...selected, id]); setOpen(false) }} />}
        </PopoverContent>
      </Popover>}
    </div>
    {selected.length > 0 ? <ul className="flex flex-wrap gap-2">{selected.map(id => <li key={id} className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1">
      <code className="break-all text-xs">{id}</code>{canManage && <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" disabled={disabled} aria-label={t("connectors.removeTool", { tool: id })} onClick={() => onChange(selected.filter(value => value !== id))}><X className="h-3 w-3" /></Button>}
    </li>)}</ul> : <p className="text-xs text-muted-foreground">{t("connectors.noneAllowed")}</p>}
  </div>
}