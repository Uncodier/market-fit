"use client"

import Link from "next/link"
import { Button } from "@/app/components/ui/button"
import { Home, Search } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export default function MarketplaceNotFound() {
  const { t } = useLocalization()
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("marketplace.notFound.title")}</h1>
        <p className="mt-3 text-muted-foreground">
          {t("marketplace.notFound.description")}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/marketplace">
              <Search className="mr-2 h-4 w-4" />
              {t("marketplace.cart.browse")}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              {t("marketplace.notFound.home")}
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
