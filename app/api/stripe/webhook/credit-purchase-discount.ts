import type Stripe from "stripe"
import { CREDIT_PACKAGES } from "@/lib/credit-packages"

/** A free payment-mode Checkout must prove the original package and its entire discount. */
export function isFullyDiscountedCreditsCheckout(session: Stripe.Checkout.Session): boolean {
  const creditPackage = CREDIT_PACKAGES.find(candidate => String(candidate.credits) === session.metadata?.credits)
  if (!creditPackage) return false
  const originalPrice = creditPackage.unitAmount
  return session.metadata?.type === "credits_purchase" &&
    session.mode === "payment" && session.status === "complete" &&
    session.payment_status === "no_payment_required" && session.payment_intent === null &&
    session.currency?.toLowerCase() === creditPackage.currency &&
    session.amount_subtotal === originalPrice &&
    session.amount_total === 0 && session.total_details?.amount_discount === originalPrice &&
    session.total_details.amount_tax === 0 && session.total_details.amount_shipping === 0
}