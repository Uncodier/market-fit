"use client"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardFooter } from "@/app/components/ui/card"
import { CreditCard, Loader2 } from "@/app/components/ui/icons"

type PublicDocumentPaymentActionProps = {
  title: string
  description: string
  buttonLabel: string
  processing: boolean
  onCheckout: () => void
}

/** Payment presentation only; each public document owns its eligibility and checkout. */
export function PublicDocumentPaymentAction({
  title, description, buttonLabel, processing, onCheckout,
}: PublicDocumentPaymentActionProps) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm print:hidden">
      <CardContent className="flex items-start gap-4 p-5 sm:p-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground ring-1 ring-inset ring-border/60">
          <CreditCard className="h-5 w-5" aria-hidden={true} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </CardContent>
      <CardFooter className="justify-end border-t border-border/60 bg-muted/30 p-4 sm:px-6">
        <Button
          size="lg"
          className="h-12 w-full rounded-xl px-6 text-sm sm:w-auto"
          onClick={onCheckout}
          disabled={processing}
          aria-busy={processing}
        >
          <span className="flex items-center gap-2">
            {processing
              ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden={true} />
              : <CreditCard className="h-5 w-5" aria-hidden={true} />}
            {buttonLabel}
          </span>
        </Button>
      </CardFooter>
    </Card>
  )
}