"use client"

import { cartLineKey } from "@/app/commerce/cart-modifiers"
import { Button } from "@/app/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet"

type RecoveryLine = {
  id: string
  lineKey?: string
  name: string
  cartQty: number
  modifiers?: { catalogItemId: string; name: string; cartQty: number }[]
}

type Props = {
  items: RecoveryLine[]
  pricingError?: string
  pricingAffectedLineIds: string[]
  pricingUnavailableItemIds: string[]
  retryPricing: () => void
  onRemoveLines: (lineIds: string[]) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Recovery never renders stored amounts, totals, discounts, or payment controls. */
export function CartPricingRecovery({ items, pricingError, pricingAffectedLineIds,
  pricingUnavailableItemIds, retryPricing, onRemoveLines, open, onOpenChange }: Props) {
  const content = (
    <section aria-label="Cart recovery" className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">Review your cart</h2>
      <p role={pricingError ? "alert" : "status"}>
        {pricingError || "Checking current prices…"}
      </p>
      <p className="text-sm text-muted-foreground">Payment is unavailable until all cart prices are verified.</p>
      <ul className="space-y-4">
        {items.map(line => {
          const key = cartLineKey(line)
          const unavailable = pricingUnavailableItemIds.includes(line.id)
          return (
            <li key={key} className="rounded-lg border p-3 space-y-2">
              <div className="font-medium">{line.name}</div>
              <p>Quantity: {line.cartQty}</p>
              {unavailable && <p className="text-destructive">Product unavailable</p>}
              {!!line.modifiers?.length && <ul className="text-sm">
                {line.modifiers.map((option, index) => (
                  <li key={`${option.catalogItemId}:${index}`}>
                    {option.name} — Quantity: {option.cartQty}
                    {pricingUnavailableItemIds.includes(option.catalogItemId) && " — Option unavailable"}
                  </li>
                ))}
              </ul>}
              {pricingAffectedLineIds.includes(key) && !unavailable && (
                <p className="text-destructive">This item needs attention before checkout.</p>
              )}
              <Button type="button" variant="outline" onClick={() => onRemoveLines([key])}
                aria-label={`Remove ${line.name}`}>Remove</Button>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={retryPricing} disabled={!pricingError}>Retry prices</Button>
        {pricingAffectedLineIds.length > 0 && (
          <Button type="button" variant="outline" onClick={() => onRemoveLines(pricingAffectedLineIds)}>
            Remove affected items
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => onRemoveLines(items.map(cartLineKey))}>
          Clear cart
        </Button>
      </div>
    </section>
  )

  if (!onOpenChange) return <main className="mx-auto max-w-2xl">{content}</main>
  return <>
    {!open && <div className="flex items-center justify-between gap-3 p-4" role="status">
      <span>{pricingError || "Checking current cart prices…"}</span>
      <Button type="button" variant="outline" onClick={() => onOpenChange(true)}>Review cart</Button>
    </div>}
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Cart recovery</SheetTitle>
        {content}
      </SheetContent>
    </Sheet>
  </>
}