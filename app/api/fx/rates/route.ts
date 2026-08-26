import { NextResponse } from "next/server"
import { getUsdFxRates } from "@/app/lib/fx-rates"

export async function GET() {
  const data = await getUsdFxRates()
  const hasRates = Object.keys(data.rates).length > 0

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": hasRates
        ? "public, s-maxage=21600, stale-while-revalidate=86400"
        : "public, s-maxage=60, stale-while-revalidate=120",
    },
  })
}
