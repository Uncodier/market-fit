"use client"

import type { ComponentProps } from "react"
import { ImportLeadsDialog } from "@/app/components/leads/import-leads-dialog"
import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { Download, UploadCloud } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export interface LeadsTransferActionsProps {
  segments: Array<{ id: string; name: string }>
  onImportLeads: ComponentProps<typeof ImportLeadsDialog>["onImportLeads"]
  onExportLeads: () => void
}

export function LeadsTransferActions({
  segments,
  onImportLeads,
  onExportLeads,
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
          <ToolbarIconButton label={importLabel}><UploadCloud className="h-4 w-4" aria-hidden /></ToolbarIconButton>
        }
      />
      <ToolbarIconButton label={exportLabel} onClick={onExportLeads}><Download className="h-4 w-4" aria-hidden /></ToolbarIconButton>
    </>
  )
}