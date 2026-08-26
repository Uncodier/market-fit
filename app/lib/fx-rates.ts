export type UsdFxRates = {
  base: string
  rates: Record<string, number>
  date: string
}

let cachedRates: UsdFxRates | null = null
let lastFetchTime = 0
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

function emptyRates(): UsdFxRates {
  return {
    base: "USD",
    rates: {},
    date: new Date().toISOString().split("T")[0],
  }
}

export async function getUsdFxRates(): Promise<UsdFxRates> {
  const now = Date.now()
  if (cachedRates && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedRates
  }

  try {
    const response = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", {
      next: { revalidate: 21600 },
    })
    if (!response.ok) {
      throw new Error("Failed to fetch from Frankfurter")
    }

    const data = await response.json()
    cachedRates = {
      base: data.base || "USD",
      rates: data.rates || {},
      date: data.date,
    }
    lastFetchTime = now
    return cachedRates
  } catch (error) {
    console.error("[fx/rates] Error fetching exchange rates:", error)
    return cachedRates || emptyRates()
  }
}
