"use server"

import { requireRegisterAccess } from "./access"
import {
  registerCloseSchema, registerDashboardSchema, registerError, registerMoveSchema,
  registerOpenSchema, registerPaymentScopeSchema, registerSessionSchema,
} from "./validation"
import type { RegisterDashboard, RegisterResult, RegisterSession, RegisterSummary } from "./types"

const SESSION_FIELDS = "id,site_id,location_id,currency,opened_by,closed_by,opened_at,closed_at,opening_amount,counted_amount,expected_amount,difference,notes,status,snapshot"
const PAGE_SIZE = 20
const UNAVAILABLE = "Unable to load or update the register. Please try again."

export async function getRegisterDashboard(input: unknown): Promise<RegisterResult<RegisterDashboard>> {
  try {
    const parsed = registerDashboardSchema.safeParse(input)
    if (!parsed.success) return { error: "Invalid register filters." }
    const { siteId, locationId, from, to, page } = parsed.data
    const access = await requireRegisterAccess(siteId)
    if ("error" in access) return { error: access.error }
    let historyQuery = access.supabase.from("pos_register_sessions").select(SESSION_FIELDS)
      .eq("site_id", siteId).eq("location_id", locationId).eq("status", "closed")
    if (from) historyQuery = historyQuery.gte("closed_at", `${from}T00:00:00.000Z`)
    if (to) {
      const end = new Date(`${to}T00:00:00.000Z`)
      end.setUTCDate(end.getUTCDate() + 1)
      historyQuery = historyQuery.lt("closed_at", end.toISOString())
    }
    const [active, history] = await Promise.all([
      access.supabase.from("pos_register_sessions").select(SESSION_FIELDS)
        .eq("site_id", siteId).eq("location_id", locationId).eq("status", "open").maybeSingle(),
      historyQuery.order("closed_at", { ascending: false }).order("id", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    ])
    if (active.error || history.error) return { error: registerError(active.error || history.error) }
    return { data: {
      active: active.data as RegisterSession | null,
      history: (history.data || []).slice(0, PAGE_SIZE) as RegisterSession[],
      hasMore: (history.data || []).length > PAGE_SIZE, role: access.role, userId: access.user.id,
    } }
  } catch { return { error: UNAVAILABLE } }
}

export async function getRegisterSummary(input: unknown): Promise<RegisterResult<RegisterSummary>> {
  try {
    const parsed = registerSessionSchema.safeParse(input)
    if (!parsed.success) return { error: "Invalid register session." }
    const access = await requireRegisterAccess(parsed.data.siteId)
    if ("error" in access) return { error: access.error }
    const session = await access.supabase.from("pos_register_sessions").select("id,status,snapshot")
      .eq("site_id", parsed.data.siteId).eq("id", parsed.data.sessionId).maybeSingle()
    if (session.error) return { error: registerError(session.error) }
    if (!session.data) return { error: "Register session not found." }
    if (session.data.status === "closed") return { data: session.data.snapshot as RegisterSummary }
    const result = await access.supabase.rpc("pos_register_summary", { p_session_id: session.data.id })
    return result.error ? { error: registerError(result.error) } : { data: result.data as RegisterSummary }
  } catch { return { error: UNAVAILABLE } }
}

export async function getActiveRegisterForPayment(input: unknown): Promise<RegisterResult<RegisterSession>> {
  try {
    const parsed = registerPaymentScopeSchema.safeParse(input)
    if (!parsed.success) return { error: "Select a valid register location before collecting payment." }
    const access = await requireRegisterAccess(parsed.data.siteId)
    if ("error" in access) return { error: access.error }
    let query = access.supabase.from("pos_register_sessions").select(SESSION_FIELDS)
      .eq("site_id", parsed.data.siteId).eq("status", "open")
    if (parsed.data.locationId) query = query.eq("location_id", parsed.data.locationId)
    else query = query.eq("opened_by", access.user.id)
    const result = await query.limit(2)
    if (result.error) return { error: registerError(result.error) }
    if (result.data?.length !== 1) return { error: "Open a register in Options and select its location before collecting payment." }
    const session = result.data[0] as RegisterSession
    if (session.opened_by !== access.user.id && !["owner", "admin"].includes(access.role)) {
      return { error: "This shift belongs to another cashier. Ask a manager to close it first." }
    }
    return { data: session }
  } catch { return { error: UNAVAILABLE } }
}

export async function openRegister(input: unknown): Promise<RegisterResult<RegisterSession>> {
  try {
    const parsed = registerOpenSchema.safeParse(input)
    if (!parsed.success) return { error: "Invalid register opening. Check the amount and location." }
    const { siteId, locationId, currency, openingAmount, requestId } = parsed.data
    const access = await requireRegisterAccess(siteId)
    if ("error" in access) return { error: access.error }
    const result = await access.supabase.rpc("pos_register_open", {
      p_site_id: siteId, p_location_id: locationId, p_currency: currency,
      p_opening_amount: openingAmount, p_request_id: requestId,
    })
    return result.error ? { error: registerError(result.error) } : { data: result.data as RegisterSession }
  } catch { return { error: UNAVAILABLE } }
}

export async function moveRegisterCash(input: unknown): Promise<RegisterResult<unknown>> {
  try {
    const parsed = registerMoveSchema.safeParse(input)
    if (!parsed.success) return { error: "Enter a positive amount and a reason for the cash movement." }
    const { siteId, sessionId, kind, amount, reason, requestId } = parsed.data
    const access = await requireRegisterAccess(siteId)
    if ("error" in access) return { error: access.error }
    const scope = await access.supabase.from("pos_register_sessions").select("id")
      .eq("site_id", siteId).eq("id", sessionId).maybeSingle()
    if (scope.error) return { error: registerError(scope.error) }
    if (!scope.data) return { error: "Register session not found." }
    const result = await access.supabase.rpc("pos_register_move", {
      p_session_id: sessionId, p_kind: kind, p_amount: amount, p_reason: reason, p_request_id: requestId,
    })
    return result.error ? { error: registerError(result.error) } : { data: result.data }
  } catch { return { error: UNAVAILABLE } }
}

export async function closeRegister(input: unknown): Promise<RegisterResult<RegisterSession>> {
  try {
    const parsed = registerCloseSchema.safeParse(input)
    if (!parsed.success) return { error: "Invalid counted amount or closing notes." }
    const { siteId, sessionId, countedAmount, notes, requestId } = parsed.data
    const access = await requireRegisterAccess(siteId)
    if ("error" in access) return { error: access.error }
    const scope = await access.supabase.from("pos_register_sessions").select("id")
      .eq("site_id", siteId).eq("id", sessionId).maybeSingle()
    if (scope.error) return { error: registerError(scope.error) }
    if (!scope.data) return { error: "Register session not found." }
    const result = await access.supabase.rpc("pos_register_close", {
      p_session_id: sessionId, p_counted_amount: countedAmount, p_notes: notes, p_request_id: requestId,
    })
    return result.error ? { error: registerError(result.error) } : { data: result.data as RegisterSession }
  } catch { return { error: UNAVAILABLE } }
}