"use client"

import { useState } from "react"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Shield, Check, Lock, PlusCircle } from "../ui/icons"
import { toast } from "sonner"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { StripePaymentMethod } from "./stripe-payment-method"

interface PurchaseCreditsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credits: number
  price: number
  pricePerCredit: number
  discount?: string
}

export function PurchaseCreditsDialog({
  open,
  onOpenChange,
  credits,
  price,
  pricePerCredit,
  discount
}: PurchaseCreditsDialogProps) {
  const { t } = useLocalization()
  const { user } = useAuth()
  const { currentSite } = useSite()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!user) {
      toast.error(t('billing.errors.notLoggedIn') || "You must be logged in to purchase credits")
      return
    }

    if (!currentSite) {
      toast.error(t('billing.errors.noSite') || "Please select a site first")
      return
    }

    if (!user.email) {
      toast.error(t('billing.errors.noEmail') || "User email is required for checkout")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/stripe/checkout/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credits,
          amount: price,
          siteId: currentSite.id,
          userEmail: user.email,
          successUrl: `${window.location.origin}/billing/success?credits=${credits}`,
          cancelUrl: `${window.location.origin}/billing?tab=billing_info`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const { url, error } = await response.json()

      if (error) {
        throw new Error(error)
      }

      if (url) {
        window.location.href = url
      } else {
        throw new Error('No checkout URL received from server')
      }
    } catch (error: any) {
      console.error('Checkout error:', error)
      let errorMessage = t('billing.errors.checkoutFailed') || "Failed to start checkout. Please try again."
      
      if (error.message?.includes('STRIPE_SECRET_KEY') || error.message?.includes('Stripe')) {
        errorMessage = t('billing.errors.paymentServiceConfig') || "Payment service configuration error. Please contact support."
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = t('billing.errors.networkError') || "Network error. Please check your connection and try again."
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage)
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !isSubmitting && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <PlusCircle className="h-5 w-5 text-primary" />
            {t('billing.checkout.title') || 'Confirm Purchase'}
          </DialogTitle>
          <DialogDescription>
            {t('billing.checkout.description') || 'Review your credit package and proceed to secure checkout.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Package Details */}
          <div className="bg-muted/30 rounded-lg p-4 border border-border/50 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-medium">{t('billing.checkout.credits') || 'Credits'}</span>
              <span className="font-bold">{credits}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t('billing.checkout.pricePerCredit') || 'Price per credit'}</span>
              <span>${pricePerCredit.toFixed(2)}</span>
            </div>
            {discount && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{t('billing.checkout.discount') || 'Discount'}</span>
                <span className="text-green-600 font-medium">{discount}</span>
              </div>
            )}
            <div className="border-t border-border pt-3 mt-3 flex justify-between items-center text-lg font-semibold">
              <span>{t('billing.checkout.total') || 'Total'}</span>
              <span>${price.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <h4 className="font-medium mb-3 text-sm">{t('billing.checkout.paymentMethod') || 'Payment Method'}</h4>
            <StripePaymentMethod siteId={currentSite?.id} compact />
          </div>

          {/* Security Features */}
          <div className="text-xs text-muted-foreground space-y-2 bg-primary/5 p-3 rounded-md border border-primary/10">
            <div className="flex items-center gap-2 font-medium text-primary mb-1">
              <Shield className="h-4 w-4" />
              <span>{t('billing.checkout.securePayment') || 'Secure Payment via Stripe'}</span>
            </div>
            <p className="flex items-center gap-1.5">
              <Check className="h-3 w-3 text-primary" />
              {t('billing.checkout.encryption') || 'Industry-leading encryption'}
            </p>
            <p className="flex items-center gap-1.5">
              <Check className="h-3 w-3 text-primary" />
              {t('billing.checkout.authentication') || '3D Secure authentication'}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="sm:w-full"
          >
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="sm:w-full"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 mr-2 animate-pulse bg-muted/50 rounded" />
                {t('billing.checkout.processing') || 'Processing...'}
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                {t('billing.checkout.confirm') || 'Continue to Payment'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
