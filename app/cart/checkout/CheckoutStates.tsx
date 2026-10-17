"use client"

import Link from "next/link"
import { ArrowLeft } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { CommerceShellHeader } from "@/app/components/commerce/CommerceShellHeader"
import { useLocalization } from "@/app/context/LocalizationContext"

export function CheckoutLoadingState() {
  const { t } = useLocalization()
  return (
    <div role="status" className="min-h-screen bg-muted/30 flex items-center justify-center">
      {t("checkout.loading")}
    </div>
  )
}

export function CheckoutEmptyState({ returnTo }: { returnTo: string }) {
  const { t } = useLocalization()
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        brand={
          <Link href={returnTo} className="flex items-center text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="font-medium">{t("checkout.backToStore")}</span>
          </Link>
        }
        actions={<div />}
      />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">{t("checkout.empty.title")}</h2>
          <p className="text-muted-foreground mb-6">{t("checkout.empty.description")}</p>
          <Button asChild size="lg" className="rounded-xl">
            <Link href={returnTo}>{t("checkout.continueShopping")}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}