"use client"

import type { ComponentProps } from "react"
import { ImportLeadsDialog } from "@/app/components/leads/import-leads-dialog"
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
  const buttonClassName = mobile
    ? "flex h-11 w-full items-center justify-start gap-2 rounded-md"
    : "flex items-center gap-1"

  return (
    <div className={mobile ? "flex w-full flex-col gap-2" : "hidden shrink-0 items-center gap-2 md:flex"}>
      <ImportLeadsDialog
        segments={segments}
        onImportLeads={onImportLeads}
        trigger={
          <Button variant="ghost" size="sm" className={buttonClassName} title={importLabel}>
            <UploadCloud className="h-4 w-4" />
            <span>{importLabel}</span>
          </Button>
        }
      />
      {!mobile && <div className="mx-1 h-6 w-px bg-border" />}
      <Button variant="ghost" size="sm" className={buttonClassName} title={exportLabel} onClick={onExportLeads}>
        <Download className="h-4 w-4" />
        <span>{exportLabel}</span>
      </Button>
    </div>
  )
}