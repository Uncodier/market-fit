import { Deal } from "@/app/deals/types"

export function formatDealCurrency(amount: number | string | null, currency: string = "USD") {
  if (amount === null || amount === undefined || amount === "") return null
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount
  if (Number.isNaN(numAmount)) return null
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(numAmount)
}

export function dealWinProbability(stage: Deal["stage"]) {
  switch (stage) {
    case "prospecting":
      return "10%"
    case "qualification":
      return "30%"
    case "proposal":
      return "50%"
    case "negotiation":
      return "80%"
    case "closed_won":
      return "100%"
    default:
      return "0%"
  }
}

export const DEAL_STAGE_TO_JOURNEY: Record<Deal["stage"], string> = {
  prospecting: "awareness",
  qualification: "consideration",
  proposal: "decision",
  negotiation: "decision",
  closed_won: "purchase",
  closed_lost: "decision",
}
