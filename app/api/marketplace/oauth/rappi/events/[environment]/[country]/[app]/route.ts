import { receiveRappiProvisioning } from "@/lib/marketplace/merchant/control-events"

export const runtime = "nodejs"
export const maxDuration = 120
export async function POST(request: Request, context: { params: Promise<{ environment: string; country: string; app: string }> }) {
  try { await receiveRappiProvisioning(request, await context.params); return new Response(null, { status: 200 }) }
  catch { return Response.json({ error: "Provisioning event could not be authenticated or committed" }, { status: 503 }) }
}