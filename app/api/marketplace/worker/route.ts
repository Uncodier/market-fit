import { isWorkerDispatchAuthorized } from "@/lib/auth/worker-dispatch"
import { pollMarketplaceStores } from "@/lib/marketplace/poll"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  if (!isWorkerDispatchAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await pollMarketplaceStores(Date.now() + 180_000)
    return Response.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return Response.json({ error: "Marketplace recovery worker unavailable" }, { status: 503 })
  }
}