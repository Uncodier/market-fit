"use client"

import Link from "next/link"
import { Button } from "@/app/components/ui/button"
import { CheckCircle } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

type BankTransfer = {
  bank_name?: string
  account_holder?: string
  account_number?: string
  routing_number?: string
  instructions?: string
}

interface CommerceOrderSuccessProps {
  title: string
  description: string
  continueLabel: string
  onContinue: () => void
  paymentMethod?: string
  bankTransfer?: BankTransfer | null
  primaryHref?: string
  primaryLabel?: string
  className?: string
}

export function CommerceOrderSuccess({
  title,
  description,
  continueLabel,
  onContinue,
  paymentMethod,
  bankTransfer,
  primaryHref,
  primaryLabel,
  className = "bg-muted/30",
}: CommerceOrderSuccessProps) {
  const { t } = useLocalization()
  const showBank = paymentMethod === "bank_transfer" && !!bankTransfer?.account_number

  return (
    <div className={`flex-1 flex items-center justify-center p-6 min-h-screen ${className}`}>
      <div className="max-w-md w-full bg-card p-10 rounded-2xl shadow-xl text-center border">
        <div className="mx-auto mb-6 bg-green-100 dark:bg-green-900/30 w-20 h-20 rounded-full flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-3xl font-bold mb-4">{title}</h2>
        <p className="text-muted-foreground mb-6 text-lg">{description}</p>

        {showBank && bankTransfer && (
          <div className="text-left mb-8 p-4 bg-muted/30 border rounded-xl text-sm">
            <h4 className="font-bold text-base mb-2">
              {t("shop.bankTransfer.completePayment") || "Complete your payment"}
            </h4>
            <p className="text-muted-foreground mb-4">
              {t("shop.bankTransfer.instruction") ||
                "Please transfer the total amount to the following account to process your order."}
            </p>
            <div className="space-y-2">
              {bankTransfer.bank_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("shop.bankTransfer.bank") || "Bank:"}</span>
                  <span className="font-medium">{bankTransfer.bank_name}</span>
                </div>
              )}
              {bankTransfer.account_holder && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("shop.bankTransfer.accountName") || "Account Name:"}
                  </span>
                  <span className="font-medium">{bankTransfer.account_holder}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("shop.bankTransfer.accountIban") || "Account / IBAN:"}
                </span>
                <span className="font-medium font-mono">{bankTransfer.account_number}</span>
              </div>
              {bankTransfer.routing_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("shop.bankTransfer.routingSwift") || "Routing / SWIFT:"}
                  </span>
                  <span className="font-medium">{bankTransfer.routing_number}</span>
                </div>
              )}
              {bankTransfer.instructions && (
                <div className="pt-2 mt-2 border-t text-muted-foreground">
                  {bankTransfer.instructions}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {primaryHref && primaryLabel && (
            <Link href={primaryHref}>
              <Button className="w-full h-14 text-lg rounded-xl">{primaryLabel}</Button>
            </Link>
          )}
          <Button
            variant={primaryHref ? "outline" : "default"}
            onClick={onContinue}
            className="w-full h-14 text-lg rounded-xl"
          >
            {continueLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
