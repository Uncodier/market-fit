"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { toast } from "sonner"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { FileText, ShoppingCart, User } from "@/app/components/ui/icons"
import { Deal } from "@/app/deals/types"
import { updateDeal } from "@/app/deals/actions"
import { LinkTeamMemberDialog } from "./LinkTeamMemberDialog"
import { dealWinProbability, formatDealCurrency } from "./deal-format"
import { useDealCommerce } from "./use-deal-commerce"

export function DealIdentityHeader({
  deal,
  onUpdate,
}: {
  deal: Deal
  onUpdate: (deal: Deal) => void
}) {
  const commerce = useDealCommerce(deal, onUpdate)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(deal.name)
  const [assignOpen, setAssignOpen] = useState(false)

  const companyName = deal.companies?.name || deal.company?.name
  const amountLabel = formatDealCurrency(deal.amount, deal.currency) || "No amount"
  const subtitle = [companyName || "No company", amountLabel].join(" · ")

  const closeLabel = deal.expected_close_date
    ? `Expected close ${new Date(deal.expected_close_date).toLocaleDateString()}`
    : "No close date"
  const scoreLabel =
    deal.qualification_score !== null && deal.qualification_score !== undefined
      ? `Score ${deal.qualification_score}%`
      : "Not scored"
  const winLabel = `Win probability ${dealWinProbability(deal.stage)}`

  const primaryOwner = deal.owners?.[0]
  const ownerName = primaryOwner?.user?.name || primaryOwner?.user?.email || "Owner"
  const extraOwners = Math.max(0, (deal.owners?.length || 0) - 1)

  const saveName = async () => {
    const next = nameDraft.trim()
    if (!next || next === deal.name) {
      setEditingName(false)
      setNameDraft(deal.name)
      return
    }
    const result = await updateDeal({ id: deal.id, name: next })
    if (result.error) {
      toast.error(result.error)
      return
    }
    if (result.deal) onUpdate(result.deal)
    setEditingName(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <EntityAvatar name={deal.name} className="h-11 w-11 text-sm" />
          <div className="min-w-0">
            {editingName ? (
              <Input
                autoFocus
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => void saveName()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveName()
                  if (event.key === "Escape") {
                    setNameDraft(deal.name)
                    setEditingName(false)
                  }
                }}
                className="h-8 text-xl font-semibold max-w-sm"
              />
            ) : (
              <h1
                className="text-xl font-semibold leading-tight truncate cursor-text rounded-md px-1 -mx-1 hover:bg-muted/50"
                onClick={() => {
                  setNameDraft(deal.name)
                  setEditingName(true)
                }}
                title={deal.name}
              >
                {deal.name}
              </h1>
            )}
            <p className="text-sm text-muted-foreground truncate mt-0.5">{subtitle}</p>
            <p className="text-xs text-muted-foreground/80 truncate mt-1">
              {closeLabel} · {scoreLabel} · {winLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            disabled={commerce.isCreatingQuote}
            onClick={() => void commerce.handleCreateQuotation()}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            {commerce.isCreatingQuote ? "Creating..." : "Quote"}
          </Button>
          {!deal.sales_order_id && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              disabled={commerce.isCreatingSale}
              onClick={() => void commerce.handleCreateSale()}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              {commerce.isCreatingSale ? "Creating..." : "Sale"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 px-2 max-w-[180px]"
            onClick={() => setAssignOpen(true)}
          >
            {primaryOwner ? (
              <EntityAvatar name={ownerName} className="h-5 w-5 text-[9px]" />
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
            <span className="truncate text-xs">{primaryOwner ? ownerName : "Assign"}</span>
            {extraOwners > 0 && (
              <span className="text-xs text-muted-foreground">+{extraOwners}</span>
            )}
          </Button>
        </div>
      </div>

      <LinkTeamMemberDialog
        deal={deal}
        isOpen={assignOpen}
        onOpenChange={setAssignOpen}
        onLinked={onUpdate}
      />
    </div>
  )
}
