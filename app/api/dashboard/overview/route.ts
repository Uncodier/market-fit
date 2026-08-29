import { NextRequest, NextResponse } from "next/server"
import { GET as revenue } from "@/app/api/revenue/route"
import { GET as ltv } from "@/app/api/ltv/route"
import { GET as cac } from "@/app/api/cac/route"
import { GET as cpl } from "@/app/api/cpl/route"
import { GET as roi } from "@/app/api/roi/route"
import { GET as activeUsers } from "@/app/api/active-users/route"
import { GET as activeSegments } from "@/app/api/active-segments/route"
import { GET as activeCampaigns } from "@/app/api/active-campaigns/route"

type Handler = (request: NextRequest) => Promise<Response>

const HANDLERS: Record<string, Handler> = {
  revenue,
  ltv,
  cac,
  cpl,
  roi,
  "active-users": activeUsers,
  "active-segments": activeSegments,
  "active-campaigns": activeCampaigns,
}

async function readHandler(handler: Handler, request: NextRequest, path: string) {
  const url = new URL(request.url)
  url.pathname = `/api/${path}`
  try {
    const response = await handler(new NextRequest(url, { headers: request.headers }))
    return await response.json()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to load" }
  }
}

export async function GET(request: NextRequest) {
  const entries = await Promise.all(
    Object.entries(HANDLERS).map(async ([key, handler]) => [
      key,
      await readHandler(handler, request, key),
    ])
  )
  return NextResponse.json(Object.fromEntries(entries))
}
