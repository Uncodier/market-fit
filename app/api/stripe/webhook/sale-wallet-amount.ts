import type Stripe from "stripe"

type WalletAmount = { amount: number; currency: "USD" }

function usdAmount(amountMinor: number): WalletAmount {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Stripe USD wallet amount must be a positive minor-unit integer")
  }
  return { amount: amountMinor / 100, currency: "USD" }
}

function objectId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id || null
}

/** Resolve gross USD revenue, never net proceeds or a relabeled local amount. */
export async function resolveStripeSaleWalletAmount(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<WalletAmount> {
  if (session.mode !== "payment" || session.status !== "complete" || session.payment_status !== "paid") {
    throw new Error("Stripe wallet settlement requires a complete paid payment checkout")
  }
  if (!Number.isSafeInteger(session.amount_total) || (session.amount_total ?? 0) <= 0 || !session.currency) {
    throw new Error("Stripe wallet settlement has an invalid checkout amount")
  }

  // Current Adaptive Pricing keeps amount_total in the integration currency.
  // presentment_details is informational: never convert USD a second time.
  if (session.currency.toLowerCase() === "usd") return usdAmount(session.amount_total as number)

  // Older Adaptive Pricing sessions expose the original price separately.
  if (session.currency_conversion?.source_currency.toLowerCase() === "usd") {
    return usdAmount(session.currency_conversion.amount_total)
  }

  const paymentIntentId = objectId(session.payment_intent)
  if (!paymentIntentId) throw new Error("Non-USD checkout has no verifiable USD settlement")
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  })
  if (intent.id !== paymentIntentId || intent.status !== "succeeded" ||
      intent.currency.toLowerCase() !== session.currency.toLowerCase() ||
      intent.amount !== session.amount_total || intent.amount_received !== session.amount_total) {
    throw new Error("Stripe payment intent does not match the paid checkout")
  }

  let charge = intent.latest_charge
  if (typeof charge === "string") {
    charge = await stripe.charges.retrieve(charge, { expand: ["balance_transaction"] })
  }
  if (!charge || objectId(charge.payment_intent) !== paymentIntentId || !charge.paid ||
      charge.status !== "succeeded" || charge.currency.toLowerCase() !== session.currency.toLowerCase() ||
      charge.amount !== session.amount_total || charge.amount_captured !== session.amount_total) {
    throw new Error("Stripe charge does not match the paid checkout")
  }

  let transaction = charge.balance_transaction
  if (typeof transaction === "string") {
    transaction = await stripe.balanceTransactions.retrieve(transaction)
  }
  if (!transaction || objectId(transaction.source) !== charge.id) {
    throw new Error("Stripe USD balance transaction is not available; retry settlement later")
  }
  if (transaction.currency.toLowerCase() !== "usd") {
    throw new Error("Stripe settlement is not USD; a verified USD conversion is required before wallet credit")
  }
  return usdAmount(transaction.amount)
}