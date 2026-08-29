import { NextRequest, NextResponse } from "next/server"
import { GET as leadsContacted } from "@/app/api/performance/leads-contacted/route"
import { GET as leadsInConversation } from "@/app/api/performance/leads-in-conversation/route"
import { GET as meetings } from "@/app/api/performance/meetings/route"
import { GET as sales } from "@/app/api/performance/sales/route"
import { GET as tasks } from "@/app/api/performance/tasks/route"
import { GET as conversations } from "@/app/api/performance/conversations/route"
import { GET as contentsApproved } from "@/app/api/performance/contents-approved/route"
import { GET as requirementsCompleted } from "@/app/api/performance/requirements-completed/route"
import { GET as tokens } from "@/app/api/performance/tokens/route"
import { GET as videoMinutes } from "@/app/api/performance/video-minutes/route"
import { GET as imagesGenerated } from "@/app/api/performance/images-generated/route"
import { GET as metricsOverview } from "@/app/api/performance/metrics-overview/route"

type Handler = (request: NextRequest) => Promise<Response>

const HANDLERS: Record<string, Handler> = {
  "leads-contacted": leadsContacted,
  "leads-in-conversation": leadsInConversation,
  meetings,
  sales,
  tasks,
  conversations,
  "contents-approved": contentsApproved,
  "requirements-completed": requirementsCompleted,
  tokens,
  "video-minutes": videoMinutes,
  "images-generated": imagesGenerated,
  "metrics-overview": metricsOverview,
}

async function readHandler(handler: Handler, request: NextRequest, path: string) {
  const url = new URL(request.url)
  url.pathname = `/api/performance/${path}`
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
