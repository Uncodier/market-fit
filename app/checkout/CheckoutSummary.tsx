"use client"

import { Button } from "@/app/components/ui/button"
import { Check, Lock, Shield, ChevronLeft, PlusCircle } from "@/app/components/ui/icons"
import { Badge } from "@/app/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { useLocalization } from "@/app/context/LocalizationContext"
import { creditPackages, type CreditPackage } from "./credit-packages"

interface CheckoutSummaryProps {
  selectedPackage: CreditPackage
  isSubmitting: boolean
  showAccountInformation: boolean
  userEmail?: string | null
  siteName?: string
  onSubmit: () => Promise<void>
  onNavigate: (href: string) => void
}

export function CheckoutSummary({ selectedPackage, isSubmitting, showAccountInformation, userEmail, siteName, onSubmit, onNavigate }: CheckoutSummaryProps) {
  const { t } = useLocalization()
  return (
    <div className="min-h-screen bg-gradient-to-b from-background/40 to-background">
      <div className="container max-w-4xl px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-12">
          <button onClick={() => onNavigate('/billing')} className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-5 w-5 mr-1" />
            {t("commercePages.checkout.backToBilling")}
          </button>
          <div className="flex items-center"><span className="text-xl font-medium">Uncodie</span></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h1 className="text-2xl font-medium mb-4">{t("commercePages.checkout.title")}</h1>
            <h2 className="text-4xl font-bold mb-8">${selectedPackage.price.toFixed(2)}</h2>
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5" />
                  {t("commercePages.checkout.packageDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{t("commercePages.checkout.credits")}</span>
                  <span className="text-xl font-bold">{selectedPackage.credits}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("commercePages.checkout.pricePerCredit")}</span>
                  <span>${selectedPackage.pricePerCredit.toFixed(2)}</span>
                </div>
                {selectedPackage.discountKey && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("commercePages.checkout.discount")}</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">{t(selectedPackage.discountKey)}</Badge>
                  </div>
                )}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-lg font-semibold">
                    <span>{t("commercePages.checkout.total")}</span>
                    <span>${selectedPackage.price.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="mt-8">
              <h3 className="font-medium mb-4">{t("commercePages.checkout.otherPackages")}</h3>
              <div className="grid grid-cols-1 gap-3">
                {creditPackages.map((pkg) => (
                  <div
                    key={pkg.credits}
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-300 ${pkg.credits === selectedPackage.credits ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/20' : ''}`}
                    onClick={() => onNavigate(`/checkout?credits=${pkg.credits}`)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{t("commercePages.checkout.creditCount", { credits: pkg.credits })}</div>
                        <div className="text-sm text-muted-foreground">{t("commercePages.checkout.perCredit", { price: `$${pkg.pricePerCredit.toFixed(2)}` })}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${pkg.price.toFixed(2)}</div>
                        {pkg.discountKey && <div className="text-xs text-green-600">{t(pkg.discountKey)}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-medium mb-6">{t("commercePages.checkout.secureCheckout")}</h2>
            <div className="bg-muted/30 rounded-lg p-6 mb-6 border border-border/30">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />{t("commercePages.checkout.poweredByStripe")}
              </h3>
              <ul className="space-y-3 text-sm">
                {["security", "paymentMethods", "authentication", "compliance"].map((key) => (
                  <li key={key} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{t(`commercePages.checkout.benefits.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
            {showAccountInformation && (
              <div className="bg-muted/20 rounded-lg p-4 mb-6 border border-border/20">
                <h4 className="font-medium mb-2">{t("commercePages.checkout.accountInformation")}</h4>
                <div className="text-sm text-muted-foreground">
                  <p>{t("commercePages.checkout.loggedInAs", { email: userEmail || "" })}</p>
                  <p>{t("commercePages.checkout.creditDestination", { site: siteName || "" })}</p>
                </div>
              </div>
            )}
            <div className="bg-primary/5 rounded-lg p-4 mb-6 border border-primary/20">
              <h4 className="font-medium mb-3 text-primary">{t("commercePages.checkout.nextTitle")}</h4>
              <ol className="space-y-2 text-sm">
                {["payment", "creditsAdded", "useCredits", "confirmation"].map((key, index) => (
                  <li key={key} className="flex items-start gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">{index + 1}</span>
                    <span>{t(`commercePages.checkout.next.${key}`)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <Button className="w-full h-12 text-base" onClick={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <><div className="h-4 w-4 mr-2 animate-pulse bg-muted rounded" />{t("commercePages.checkout.redirecting")}</>
              ) : (
                <><Lock className="h-4 w-4 mr-2" />{t("commercePages.checkout.purchase", { credits: selectedPackage.credits })}</>
              )}
            </Button>
            <div className="flex justify-center items-center gap-2 text-sm text-muted-foreground mt-4">
              <Shield className="h-4 w-4" />{t("commercePages.checkout.encryption")}
            </div>
            <div className="flex justify-center items-center gap-4 mt-4">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/1200px-Stripe_Logo%2C_revised_2016.svg.png"
                alt="Stripe"
                className="h-6 w-auto opacity-60"
              />
              <span className="text-xs text-muted-foreground">{t("commercePages.checkout.trusted")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}