import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import crypto from "crypto"

type Operation = 'INSERT' | 'UPDATE' | 'DELETE'

type TestRequestBody = {
  endpoint_id: string
  site_id: string
  event_type?: string
  operation?: Operation
  table?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TestRequestBody
    const { endpoint_id, site_id, event_type, operation, table } = body || {}

    if (!endpoint_id || !site_id) {
      return NextResponse.json({ error: "endpoint_id and site_id are required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: endpoint, error: epError } = await supabase
      .from("webhooks_endpoints")
      .select("id, site_id, name, target_url, secret")
      .eq("id", endpoint_id)
      .eq("site_id", site_id)
      .single()

    if (epError || !endpoint) {
      return NextResponse.json({ error: "Endpoint not found or access denied" }, { status: 404 })
    }

    // Build simulated DB change payloads (INSERT/UPDATE/DELETE)
    const op: Operation = operation || (event_type === 'task.updated' ? 'UPDATE' : event_type === 'message.deleted' ? 'DELETE' : 'INSERT')
    const targetTable = table || (event_type?.startsWith('message') ? 'messages' : 'tasks')
    const schema = 'public'

    const nowIso = new Date().toISOString()
    const baseRecord = targetTable === 'messages'
      ? { id: `msg_${endpoint.id.slice(0,8)}`, site_id: site_id, content: 'Hello world', created_at: nowIso, updated_at: nowIso }
      : { id: `task_${endpoint.id.slice(0,8)}`, site_id: site_id, title: 'Test task', status: 'open', created_at: nowIso, updated_at: nowIso }

    const simulatedPayload = op === 'INSERT'
      ? { type: 'INSERT', table: targetTable, schema, record: baseRecord, old_record: null }
      : op === 'UPDATE'
        ? { type: 'UPDATE', table: targetTable, schema, record: { ...baseRecord, status: 'done', updated_at: nowIso }, old_record: baseRecord }
        : { type: 'DELETE', table: targetTable, schema, record: null, old_record: baseRecord }

    const bodyString = JSON.stringify(simulatedPayload)
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Uncodie-MarketFit-Webhooks/1.0",
      "X-Uncodie-Event": event_type || `${targetTable}.${op.toLowerCase()}`,
    }

    if (endpoint.secret) {
      const signature = crypto
        .createHmac("sha256", endpoint.secret)
        .update(bodyString)
        .digest("hex")
      headers["X-Uncodie-Signature"] = `sha256=${signature}`
    }

    // Use the same external API base used across the app (see api-client-service)
    const apiBase = (process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || '').trim()
    const normalizedBase = apiBase
      ? (apiBase.startsWith('http://') || apiBase.startsWith('https://') ? apiBase : `http://${apiBase}`)
      : ''

    if (!normalizedBase) {
      return NextResponse.json({ error: 'Missing NEXT_PUBLIC_API_SERVER_URL or API_SERVER_URL' }, { status: 400 })
    }

    const resp = await fetch(`${normalizedBase.replace(/\/$/, '')}/api/workflow/webhook`, {
      method: "POST",
      headers,
      body: bodyString,
    })

    const text = await resp.text()

    // Best-effort: record delivery. Ignore failures.
    try {
      await supabase.from("webhooks_deliveries").insert({
        site_id: site_id,
        endpoint_id: endpoint_id,
        subscription_id: null,
        event_type: headers["X-Uncodie-Event"],
        payload: simulatedPayload as any,
        status: resp.ok ? "delivered" : "failed",
        attempt_count: 1,
        response_status: resp.status,
        response_body: text?.slice(0, 2000) || null,
        delivered_at: resp.ok ? new Date().toISOString() : null,
        last_error: resp.ok ? null : `HTTP ${resp.status}`,
      })
    } catch {
      // noop
    }

    return NextResponse.json({
      ok: resp.ok,
      status: resp.status,
      response: text?.slice(0, 1000) || "",
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to send test webhook" }, { status: 500 })
  }
}


