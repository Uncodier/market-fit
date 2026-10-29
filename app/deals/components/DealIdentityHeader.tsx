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
import { useInlineIdentityEdit } from "@/app/hooks/use-inline-identity-edit"

export function DealIdentityHeader({
  deal,
  onUpdate,
}: {
  deal: Deal
  onUpdate: (deal: Deal) => void
}) {
  const commerce = useDealCommerce(deal, onUpdate)
  const [assignOpen, setAssignOpen] = useState(false)
  const { editing, inputProps, buttonRef, startEditing, error, errorId } = useInlineIdentityEdit({
    value: deal.name,
    onSave: async (name) => {
      const result = await updateDeal({ id: deal.id, name })
      if (result.error || !result.deal) throw new Error(result.error || "Failed to update deal")
      onUpdate(result.deal)
    },
    errorMessage: "Failed to update deal name. Press Enter to retry or Escape to cancel.",
    onError: () => toast.error("Failed to update deal name"),
  })

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <EntityAvatar name={deal.name} className="h-11 w-11 text-sm" />
          <div className="min-w-0">
            {editing ? (
              <Input
                autoFocus
                aria-label="Deal name"
                {...inputProps}
                className="h-8 text-xl font-semibold max-w-sm"
              />
            ) : (
              <h1 className="text-xl font-semibold leading-tight" aria-label={deal.name}>
                <Button
                  type="button"
                  variant="ghost"
                  ref={buttonRef}
                  aria-label="Edit deal name"
                  onClick={startEditing}
                  title={deal.name}
                  className="block max-w-full text-xl font-semibold leading-tight text-left truncate cursor-text rounded-md border-0 bg-transparent px-1 py-0 -mx-1 hover:bg-muted/50 hover:text-inherit active:scale-100"
                >
                  {deal.name}
                </Button>
              </h1>
            )}
            {error && (
              <p id={errorId} role="alert" className="text-xs text-destructive mt-1">
                {error}
              </p>
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
