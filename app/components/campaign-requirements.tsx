import React, { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { PlusCircle } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { navigateToRequirement } from "@/lib/navigation/navigation-helpers"
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatCurrency } from "@/app/lib/formatters"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

interface Requirement {
  id: string
  title: string
  description: string
  type: string
  priority: "high" | "medium" | "low"
  status: string
  completion_status: string
  created_at: string
  budget?: number
  segmentNames?: string[]
}

interface CampaignRequirementsProps {
  campaignId: string
  onOpenCreateRequirement?: () => void
  renderAddButton?: () => React.ReactNode
  externalRequirements?: Requirement[]
  externalLoading?: boolean
}

interface RelationData {
  requirement_id: string
}

interface SegmentRelation {
  segment_id: string
}

interface SegmentData {
  name: string
}

function requirementAccent(status: string): "due" | "cancelled" | "none" {
  if (status === "canceled" || status === "cancelled") return "cancelled"
  if (status === "backlog" || status === "on-review") return "due"
  return "none"
}

function statusLabel(status: string) {
  return status.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

export function CampaignRequirements({
  campaignId,
  onOpenCreateRequirement,
  renderAddButton,
  externalRequirements,
  externalLoading,
}: CampaignRequirementsProps) {
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { t } = useLocalization()

  useEffect(() => {
    if (externalRequirements !== undefined) {
      setRequirements(externalRequirements)
      return
    }

    const fetchRequirements = async () => {
      if (externalRequirements !== undefined) return

      setLoading(true)
      try {
        const supabase = createClient()

        const { data: relationData, error: relationError } = await supabase
          .from("campaign_requirements")
          .select("requirement_id")
          .eq("campaign_id", campaignId)

        if (relationError) throw new Error(relationError.message)

        if (!relationData || relationData.length === 0) {
          setRequirements([])
          setLoading(false)
          return
        }

        const requirementIds = relationData.map((r: RelationData) => r.requirement_id)
        const { data, error } = await supabase
          .from("requirements")
          .select("*")
          .in("id", requirementIds)

        if (error) throw new Error(error.message)

        if (data) {
          const requirementsWithSegments = await Promise.all(
            data.map(async (req: any) => {
              const { data: segmentRelations, error: segmentError } = await supabase
                .from("requirement_segments")
                .select("segment_id")
                .eq("requirement_id", req.id)

              if (segmentError) return req

              if (segmentRelations && segmentRelations.length > 0) {
                const segmentIds = segmentRelations.map((r: SegmentRelation) => r.segment_id)
                const { data: segmentData } = await supabase
                  .from("segments")
                  .select("name")
                  .in("id", segmentIds)

                return {
                  ...req,
                  segmentNames: segmentData?.map((s: SegmentData) => s.name) || [],
                }
              }

              return req
            })
          )

          setRequirements(requirementsWithSegments)
        }
      } catch (error) {
        console.error("Error fetching requirements:", error)
        toast.error("Failed to load requirements")
      } finally {
        setLoading(false)
      }
    }

    if (campaignId) fetchRequirements()
  }, [campaignId, externalRequirements])

  const isLoading = externalLoading !== undefined ? externalLoading : loading

  const navigateToRequirementDetail = (requirementId: string, requirementTitle: string) => {
    navigateToRequirement({ requirementId, requirementTitle, router })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium">
          {t("campaigns.detail.requirements.title") || "Requirements"}
        </h3>
        {renderAddButton ? (
          renderAddButton()
        ) : (
          <Button variant="outline" size="sm" onClick={onOpenCreateRequirement}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("campaigns.detail.requirements.add") || "Add Requirement"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-3">Loading requirements...</p>
      ) : requirements.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3">No requirements yet.</p>
      ) : (
        <div className={documentListShellClassName()}>
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <DocumentListHead className="w-[38%]">
                  {t("campaigns.detail.requirements.table.title") || "Title"}
                </DocumentListHead>
                <DocumentListHead className="w-[16%]">
                  {t("campaigns.detail.requirements.table.status") || "Status"}
                </DocumentListHead>
                <DocumentListHead className="w-[22%]">
                  {t("campaigns.detail.requirements.table.type") || "Type"}
                </DocumentListHead>
                <DocumentListHead className="w-[24%]" align="right">
                  {t("campaigns.detail.requirements.table.budget") || "Budget"}
                </DocumentListHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requirements.map((req) => {
                const typeLabel = (req.type || "").replace(/_/g, " ")
                const priorityLabel =
                  t(`campaigns.detail.requirements.priority.${req.priority}`) || req.priority
                const meta = [req.description, ...(req.segmentNames || [])]
                  .filter(Boolean)
                  .join(" · ") || null

                return (
                  <DocumentListRow
                    key={req.id}
                    onClick={() => navigateToRequirementDetail(req.id, req.title)}
                    accent={requirementAccent(req.status)}
                  >
                    <TableCell className="py-3.5">
                      <EntityCell
                        name={req.title}
                        secondary={null}
                        secondaryMono={false}
                        meta={meta}
                      />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <StatusDot status={req.status} label={statusLabel(req.status)} />
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-muted-foreground capitalize">
                      {typeLabel}
                      {req.priority ? ` · ${priorityLabel}` : ""}
                    </TableCell>
                    <TableCell className="py-3.5">
                      {req.budget ? (
                        <MoneyCell amountLabel={formatCurrency(req.budget)} />
                      ) : (
                        <span className="block text-right text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </DocumentListRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
