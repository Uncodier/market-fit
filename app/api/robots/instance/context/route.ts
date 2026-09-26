import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"

const breakdownKeys = ["instructions", "skills", "messages", "toolCalls", "toolDefinitions"] as const
function readBreakdown(value: unknown, usedTokens: number, source: string, measuredAt: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (Object.keys(raw).length !== 9) return null
  if (typeof raw.measuredAt !== "string" || !Number.isFinite(Date.parse(raw.measuredAt))
    || Date.parse(raw.measuredAt) !== Date.parse(measuredAt)
    || raw.usedTokens !== usedTokens || raw.source !== source) return null
  if (!["estimatedInputTokens", ...breakdownKeys].every(key => Number.isSafeInteger(raw[key]) && (raw[key] as number) >= 0)) return null
  if (breakdownKeys.reduce((sum, key) => sum + (raw[key] as number), 0) !== raw.estimatedInputTokens) return null
  if (source === "estimate" && raw.estimatedInputTokens !== usedTokens) return null
  return Object.fromEntries(["estimatedInputTokens", ...breakdownKeys].map(key => [key, raw[key]]))
}

export async function GET(request: NextRequest) {
  const id = z.string().uuid().safeParse(request.nextUrl.searchParams.get("instance_id"))
  const siteId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("site_id"))
  if (!id.success || !siteId.success) {
    return NextResponse.json({ error: "Invalid instance or site" }, { status: 400 })
  }
  const access = await requireSiteAccess(request, siteId.data)
  if (access.error) return access.error
  const { data: instance, error: instanceError } = await access.supabase
    .from("remote_instances").select("id").eq("id", id.data)
    .eq("site_id", siteId.data).maybeSingle()
  if (instanceError) return NextResponse.json({ error: "Lookup failed" }, { status: 503 })
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 })
  let { data, error } = await access.supabase.from("instance_context_state")
    .select("model,provider,used_tokens,output_tokens,available_tokens,reserved_output_tokens,measured_at,source,input_breakdown")
    .eq("instance_id", id.data).eq("site_id", siteId.data).maybeSingle()
  if (error?.code === "42703" || error?.code === "PGRST204") {
    const missingOutput = error.code === "42703" && /\boutput_tokens\b/.test(error.message)
    const missingBreakdown = error.code === "42703" && /\binput_breakdown\b/.test(error.message)
    const legacy = await access.supabase.from("instance_context_state")
      .select(missingBreakdown
        ? "model,provider,used_tokens,output_tokens,available_tokens,reserved_output_tokens,measured_at,source"
        : missingOutput
          ? "model,provider,used_tokens,available_tokens,reserved_output_tokens,measured_at,source"
          : "model,provider,used_tokens,output_tokens,available_tokens,measured_at,source")
      .eq("instance_id", id.data).eq("site_id", siteId.data).maybeSingle()
    data = legacy.data
    error = legacy.error
  }
  if (error?.code === "42703" || error?.code === "PGRST204") {
    const older = await access.supabase.from("instance_context_state")
      .select("model,provider,used_tokens,available_tokens,measured_at,source")
      .eq("instance_id", id.data).eq("site_id", siteId.data).maybeSingle()
    data = older.data
    error = older.error
  }
  if (error) return NextResponse.json({ error: "Context unavailable" }, { status: 503 })
  if (!data?.model || !data.measured_at) return NextResponse.json({ context: null })
  const availableTokens = data.available_tokens ?? null
  // Match the API's legacy model-specific reserve until a new checkpoint is saved.
  const knownReserve: Record<string, number> = {
    "gemini:gemini-3.1-pro-preview": 0,
    "gemini:gemini-3.1-pro-preview-customtools": 0,
    "openai:gpt-4o": 16_384,
    "openai:gpt-5.2": 128_000,
    "xai:grok-4.6": 2048,
  }
  const reservedOutputTokens = data.reserved_output_tokens ?? (availableTokens
    ? knownReserve[`${data.provider}:${data.model}`] ?? Math.max(2048, Math.ceil(availableTokens * .1)) : 0)
  return NextResponse.json({ context: {
    model: data.model, provider: data.provider, usedTokens: data.used_tokens || 0,
    outputTokens: data.output_tokens ?? null, availableTokens, reservedOutputTokens,
    breakdown: readBreakdown(data.input_breakdown, data.used_tokens || 0, data.source, data.measured_at),
    utilization: availableTokens ? Math.min(1, (data.used_tokens || 0) / Math.max(1, availableTokens - reservedOutputTokens)) : null,
    source: data.source, measuredAt: data.measured_at,
  } })
}
