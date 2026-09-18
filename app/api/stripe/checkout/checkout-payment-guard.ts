import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
])

const STRIPE_UGX_CURRENCY = "ugx"

type PayableSale = {
  id: string
  status?: string | null
  amount_due?: number | string | null
  stripe_checkout_session_id?: string | null
}

type CheckoutRpcClient = Pick<SupabaseClient, "rpc">

export function payableAmount(
  sale: PayableSale | null | undefined
): { amount: number; error?: undefined } | { amount?: undefined; error: string } {
  if (!sale) return { error: "Payment record not found" }
  if (sale.status !== "pending" && sale.status !== "completed") {
    return { error: "This payment is no longer available" }
  }

  const amount = Number(sale.amount_due)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "This document has no outstanding balance" }
  }

  return { amount }
}

export function toStripeMinorAmount(amount: number, currency: string): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError("Stripe amount must be a finite, non-negative number")
  }

  const normalizedCurrency = currency.trim().toLowerCase()
  if (!normalizedCurrency) {
    throw new RangeError("Stripe currency is required")
  }
  if (normalizedCurrency === STRIPE_UGX_CURRENCY && !Number.isInteger(amount)) {
    throw new RangeError("Stripe requires UGX amounts to use whole currency units")
  }

  const minorAmount = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)
    ? Math.round(amount)
    : Math.round((amount + Number.EPSILON) * 100)

  if (!Number.isSafeInteger(minorAmount)) {
    throw new RangeError("Stripe amount exceeds the supported integer range")
  }
  return minorAmount
}

export function fromStripeMinorAmount(amountMinor: number, currency: string): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError("Stripe minor amount must be a non-negative integer")
  }

  const normalizedCurrency = currency.trim().toLowerCase()
  if (!normalizedCurrency) {
    throw new RangeError("Stripe currency is required")
  }
  if (
    normalizedCurrency === STRIPE_UGX_CURRENCY &&
    amountMinor % 100 !== 0
  ) {
    throw new RangeError("Stripe UGX minor amounts must be divisible by 100")
  }

  return ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)
    ? amountMinor
    : amountMinor / 100
}

export function outstandingBalanceLineItem(params: {
  amount: number
  currency: string
  name: string
}): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    price_data: {
      currency: params.currency.toLowerCase(),
      product_data: { name: params.name },
      unit_amount: toStripeMinorAmount(params.amount, params.currency),
    },
    quantity: 1,
  }
}

export async function existingCheckoutResult(
  stripe: Stripe,
  sessionId: string | null | undefined,
  expected: { amountMinor: number; currency: string; saleId?: string }
): Promise<
  | { url: string; error?: undefined }
  | { error: string; url?: undefined }
  | null
> {
  if (!sessionId) return null

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const matchesAmount = session.amount_total === expected.amountMinor
    const matchesCurrency =
      session.currency?.toLowerCase() === expected.currency.toLowerCase()
    const matchesSale =
      !expected.saleId || session.metadata?.sale_id === expected.saleId
    const matchesExpectedCheckout =
      matchesAmount && matchesCurrency && matchesSale

    if (session.status === "open" && session.url) {
      if (matchesExpectedCheckout) return { url: session.url }

      await stripe.checkout.sessions.expire(session.id)
      return null
    }
    if (session.status === "complete" && matchesExpectedCheckout) {
      return { error: "Payment is already being processed" }
    }
    return null
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "resource_missing"
    ) {
      return null
    }
    throw error
  }
}

export function checkoutIdempotencyKey(params: {
  saleId: string
  amountMinor: number
  currency: string
  attempt: number
}): string {
  return [
    "public-checkout",
    "sale",
    params.saleId,
    params.attempt,
    params.currency.toLowerCase(),
    params.amountMinor,
  ].join(":")
}

export type CheckoutAttemptReservation =
  | { status: "reserved"; attempt: number }
  | { status: "checkout_changed"; sessionId: string | null }
  | { status: "rejected"; error: string }

export async function reserveCheckoutAttempt(
  supabase: CheckoutRpcClient,
  params: {
    saleId: string
    amountMinor: number
    currency: string
    expectedSessionId?: string | null
  }
): Promise<CheckoutAttemptReservation> {
  const { data, error } = await supabase.rpc("reserve_stripe_checkout_attempt", {
    p_sale_id: params.saleId,
    p_amount_minor: params.amountMinor,
    p_currency: params.currency.toLowerCase(),
    p_expected_session_id: params.expectedSessionId || null,
  })

  if (error) {
    throw new Error(`Failed to reserve checkout attempt: ${error.message}`)
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Checkout attempt reservation returned an invalid response")
  }

  const result = data as Record<string, unknown>
  if (result.status === "reserved") {
    const attempt = Number(result.attempt)
    if (!Number.isSafeInteger(attempt) || attempt < 1) {
      throw new Error("Checkout attempt reservation returned an invalid version")
    }
    return { status: "reserved", attempt }
  }
  if (result.status === "checkout_changed") {
    return {
      status: "checkout_changed",
      sessionId:
        typeof result.session_id === "string" ? result.session_id : null,
    }
  }

  return {
    status: "rejected",
    error:
      typeof result.reason === "string"
        ? result.reason
        : "This payment is no longer available",
  }
}

export async function linkCheckoutSession(
  supabase: CheckoutRpcClient,
  params: {
    saleId: string
    attempt: number
    sessionId: string
    amountMinor: number
    currency: string
  }
): Promise<boolean> {
  const { data, error } = await supabase.rpc("link_stripe_checkout_session", {
    p_sale_id: params.saleId,
    p_attempt: params.attempt,
    p_session_id: params.sessionId,
    p_amount_minor: params.amountMinor,
    p_currency: params.currency.toLowerCase(),
  })

  if (error) {
    throw new Error(`Failed to persist checkout session: ${error.message}`)
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Checkout session persistence returned an invalid response")
  }

  return (data as Record<string, unknown>).status === "linked"
}
