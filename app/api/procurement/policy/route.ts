import { NextResponse } from "next/server"
import { z } from "zod"
import { policyDocumentSchema } from "@/app/purchases/procurement/domain"
import { isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import { privateHeaders, procurementAccess, procurementError } from "../http"
import { validatePolicyReferences } from "./validate-references"
import { assignRuleVersions } from "./rule-versions"

const saveSchema = z.object({
  expected_revision: z.number().int().nonnegative().max(2147483646),
  document: policyDocumentSchema,
}).strict()
const rowSchema = z.object({
  revision: z.number().int().positive(), document: policyDocumentSchema,
  created_at: z.string(), created_by: z.string().uuid(),
})

export async function GET(request: Request) {
  try {
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const { data, error } = await access.supabase.from("procurement_policy_versions")
      .select("revision, document, created_at, created_by").eq("site_id", access.siteId)
      .order("revision", { ascending: false }).limit(1).maybeSingle()
    if (error) return procurementError("Procurement storage is unavailable. Check the required migration.", 503)
    const result = data ? rowSchema.parse(data) : { revision: 0, document: null }
    return NextResponse.json(result, { headers: privateHeaders })
  } catch {
    return procurementError("Unable to load procurement configuration", 503)
  }
}

export async function PUT(request: Request) {
  try {
    if (!isSameOriginApiRequest(request)) return procurementError("Cross-origin writes are not allowed", 403)
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return procurementError("Use application/json", 415)
    }
    const access = await procurementAccess(request)
    if (access.error) return access.error
    let raw: unknown
    try {
      raw = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 256 * 1024)))
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) return procurementError("Configuration exceeds the size limit", 413)
      return procurementError("Invalid JSON document", 400)
    }
    const parsed = saveSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid procurement configuration",
        issues: parsed.error.issues.slice(0, 20).map(issue => ({ path: issue.path.join("."), message: issue.message })),
      }, { status: 400, headers: privateHeaders })
    }
    let previous = null
    if (parsed.data.expected_revision > 0) {
      const { data: snapshot, error: readError } = await access.supabase.from("procurement_policy_versions")
        .select("document").eq("site_id", access.siteId).eq("revision", parsed.data.expected_revision).maybeSingle()
      if (readError) return procurementError("Unable to verify the previous configuration", 503)
      if (!snapshot) return procurementError("Configuration changed. Reload before saving again.", 409)
      previous = policyDocumentSchema.parse(snapshot.document)
    }
    if (!await validatePolicyReferences(access.supabase, access.siteId, parsed.data.document, previous)) {
      return procurementError("People, agents, products and categories must belong to this workspace and remain eligible", 400)
    }
    const canonicalDocument = assignRuleVersions(parsed.data.document, previous)
    const { data, error } = await access.supabase.rpc("save_procurement_policy", {
      p_site_id: access.siteId, p_expected_revision: parsed.data.expected_revision,
      p_document: canonicalDocument,
    })
    if (error?.code === "40001") return procurementError("Configuration changed. Reload before saving again.", 409)
    if (error?.code === "42501") return procurementError("Procurement access was revoked", 403)
    if (["22023", "23514", "23502"].includes(error?.code ?? "")) return procurementError("The database rejected this configuration", 400)
    if (error) return procurementError("Unable to save configuration. Check the required migration.", 503)
    return NextResponse.json(rowSchema.parse(Array.isArray(data) ? data[0] : data), { headers: privateHeaders })
  } catch {
    return procurementError("Unable to save procurement configuration", 503)
  }
}