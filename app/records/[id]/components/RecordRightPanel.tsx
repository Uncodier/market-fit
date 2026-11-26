"use client"

import { ScrollArea } from "@/app/components/ui/scroll-area"
import { stickyHeaderBorderClassName } from "@/app/components/ui/sticky-header-styles"
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import type { RecordItem } from "../../actions"
import { RecordInsightView } from "./InsightsTab"
import { useSharedRecordInsights } from "./record-insight-context"
import { RelationsTab } from "./RelationsTab"

interface RecordRightPanelProps {
  activeTab: "insights" | "relations"
  record: RecordItem
  formData: Record<string, any>
  description: string
  relationsData: Record<string, any>
  onTabChange: (tab: "insights" | "relations") => void
}

export function RecordRightPanel({
  activeTab,
  record,
  formData,
  description,
  relationsData,
  onTabChange,
}: RecordRightPanelProps) {
  const templateFields = record.category?.template_fields || []
  const { insights } = useSharedRecordInsights()

  return (
    <div className="w-[400px] flex-none border-l border-border bg-background">
      <div className="flex h-full min-h-0 flex-col">
        <div className={`flex h-[71px] items-center justify-center px-4 ${stickyHeaderBorderClassName}`}>
          <ToggleGroup
            type="single"
            value={activeTab}
            onValueChange={(value: string) => value && onTabChange(value as "insights" | "relations")}
            className="w-full"
          >
            <ToggleGroupItem value="insights" className="flex-1" aria-label="Insights">
              Insights
            </ToggleGroupItem>
            <ToggleGroupItem value="relations" className="flex-1" aria-label="Relations">
              Relations
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {activeTab === "insights" ? (
              <RecordInsightView
                insights={insights}
                fields={templateFields}
                formData={formData}
                description={description}
                record={record}
                relationsData={relationsData}
              />
            ) : (
              <RelationsTab
                fields={templateFields.filter((field: any) => field.type === "relation")}
                relationsData={relationsData}
                recordId={record.id}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
