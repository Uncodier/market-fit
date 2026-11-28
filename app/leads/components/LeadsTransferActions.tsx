"use client"

import type { ComponentProps } from "react"
import { ImportLeadsDialog } from "@/app/components/leads/import-leads-dialog"
import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { Button } from "@/app/components/ui/button"
import { Download, UploadCloud } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export interface LeadsTransferActionsProps {
  segments: Array<{ id: string; name: string }>
  onImportLeads: ComponentProps<typeof ImportLeadsDialog>["onImportLeads"]
  onExportLeads: () => void
  mobile?: boolean
}

export function LeadsTransferActions({
  segments,
  onImportLeads,
  onExportLeads,
  mobile = false,
}: LeadsTransferActionsProps) {
  const { t } = useLocalization()
  const importLabel = t("layout.topbar.import") || "Import"
  const exportLabel = t("layout.topbar.export") || "Export"
  return (
    <>
      <ImportLeadsDialog
        segments={segments}
        onImportLeads={onImportLeads}
        trigger={
          mobile ? <Button variant="ghost" size="sm" className="flex h-11 w-full justify-start gap-2 rounded-md">
            <UploadCloud className="h-4 w-4" aria-hidden />{importLabel}
          </Button> : <ToolbarIconButton label={importLabel}><UploadCloud className="h-4 w-4" aria-hidden /></ToolbarIconButton>
        }
      />
      {mobile ? <Button variant="ghost" size="sm" className="flex h-11 w-full justify-start gap-2 rounded-md" onClick={onExportLeads}>
        <Download className="h-4 w-4" aria-hidden />{exportLabel}
      </Button> : <ToolbarIconButton label={exportLabel} onClick={onExportLeads}><Download className="h-4 w-4" aria-hidden /></ToolbarIconButton>}
    </>
  )
}