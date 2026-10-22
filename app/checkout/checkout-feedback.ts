type Translate = (key: string) => string

const checkoutErrorKeys: Record<string, string> = {
  "No checkout URL received from server": "commercePages.checkout.errors.missingUrl",
  "Payment service configuration error. Please contact support.": "commercePages.checkout.errors.configuration",
  "Failed to create checkout session": "commercePages.checkout.errors.createSession",
  "Invalid checkout request": "commercePages.checkout.errors.invalidRequest",
  "Invalid credit package": "commercePages.checkout.errors.invalidPackage",
  "A trusted checkout origin is required": "commercePages.checkout.errors.origin",
  "Invalid checkout return URL": "commercePages.checkout.errors.returnUrl",
  "Invalid checkout success URL": "commercePages.checkout.errors.successUrl",
  "Unauthorized": "commercePages.checkout.errors.unauthorized",
  "Forbidden": "commercePages.checkout.errors.forbidden",
}

/** Translate known checkout failures without displaying raw provider details. */
export function localizeCheckoutError(error: unknown, t: Translate): string {
  const message = error instanceof Error ? error.message : ""
  if (message.includes("STRIPE_SECRET_KEY") || message.includes("Stripe")) {
    return t("commercePages.checkout.errors.configuration")
  }
  if (message.includes("network") || message.includes("fetch")) {
    return t("commercePages.checkout.errors.network")
  }
  return t(checkoutErrorKeys[message] || "commercePages.checkout.errors.start")
}