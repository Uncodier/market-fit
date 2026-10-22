import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/server"
import { resolveSelfServiceLocation } from "@/app/commerce/self-service"
import { recoverPublicCheckout } from "@/app/commerce/public-checkout-recovery"
import { decodeRequestBody, readLimitedRequestBody } from "@/lib/http/read-limited-request-body"
import { trustedVisitorBrowserOrigin, visitorSessionPreflight, withVisitorSessionCors } from "../../visitor-session/browser-origin"

const schema = z.object({ locationId: z.string().uuid(), attemptId: z.string().uuid() }).strict()
const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" }
export function OPTIONS(request: Request) { return visitorSessionPreflight(request) }
export async function POST(request: Request) {
  if (!trustedVisitorBrowserOrigin(request)) return Response.json({ error: "Origin not allowed" }, { status: 403, headers })
  return withVisitorSessionCors(request, await recover(request))
}
async function recover(request: Request) {
  let input: z.infer<typeof schema>
  try { input = schema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 1024)))) }
  catch { return Response.json({ error: "Invalid recovery request" }, { status: 400, headers }) }
  try {
    const client = await createServiceClient(true, { access: "public" })
    const context = await resolveSelfServiceLocation(input.locationId, client)
    if (!context) return Response.json({ error: "Location unavailable" }, { status: 404, headers })
    // The random 128-bit attempt UUID is a bearer recovery credential, never an order ID.
    const { data, error } = await client.from("pos_client_mutations").select("result")
      .eq("site_id", context.site.id).eq("client_mutation_id", input.attemptId).eq("kind", "checkout").maybeSingle()
    if (error) throw new Error("Recovery unavailable")
    if (!data) return Response.json({ state: "not_found" }, { headers })
    const result = data.result
    if (result?.recoveryLocationId !== input.locationId) return Response.json({ error: "Order confirmation unavailable" }, { status: 404, headers })
    if (!["ready", "completed"].includes(result.state)) return Response.json({ state: "processing", error: "This order requires confirmation or staff review. Do not place another order." }, { status: 409, headers })
    const claim = result.state === "ready" ? { siteId: context.site.id, clientMutationId: input.attemptId,
      ownerToken: result.ownerToken, fingerprint: result.fingerprint, recoveryLocationId: input.locationId } : undefined
    return Response.json(await recoverPublicCheckout(client, context.site.id, result, claim), { headers })
  } catch {
    return Response.json({ error: "Unable to recover order confirmation. Retry or ask staff; do not place another order." }, { status: 409, headers })
  }
}