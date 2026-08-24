"use client"

import { Button } from "@/app/components/ui/button"
import { Plus, Zap } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { WorkflowNodeType } from "./types"

export function WorkflowPalette({
  onAdd,
  canAddChild,
}: {
  onAdd: (type: WorkflowNodeType) => void
  canAddChild: boolean
}) {
  const { t } = useLocalization()
  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs font-medium px-2.5"
            onClick={() => onAdd("wf-trigger")}
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            {t("workflows.trigger") || "Trigger"}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          Add trigger
        </TooltipContent>
      </Tooltip>
      <div className="w-px h-4 bg-border mx-1" />
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs font-medium px-2.5"
              disabled={!canAddChild}
              onClick={() => onAdd("wf-step")}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              {t("workflows.step") || "Step"}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {canAddChild ? "Add step" : "Select a node first"}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
