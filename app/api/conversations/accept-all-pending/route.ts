import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { acquireOperationLease } from "@/lib/redis/operation-lease"
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from "@/lib/http/read-limited-request-body"
import { z } from "zod"

const BATCH_SIZE = 20
const MAX_MESSAGES = 1000
const bodySchema = z.object({ siteId: z.string().uuid() })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const parsed = bodySchema.safeParse(
      JSON.parse(
        decodeRequestBody(await readLimitedRequestBody(request, 8 * 1024))
      )
    )
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request" },
        { status: 400 }
      )
    }
    const { siteId } = parsed.data

    // Verify user has access to this site before using admin client
    const { data: siteAccess, error: siteAccessError } = await supabase
      .from("sites")
      .select("id")
      .eq("id", siteId)
      .single()

    if (siteAccessError || !siteAccess) {
      console.error("User does not have access to site:", siteId)
      return NextResponse.json({ success: false, error: "Forbidden: You don't have permissions" }, { status: 403 })
    }

    const lease = await acquireOperationLease(
      "accept-all-pending",
      siteId,
      60_000
    )
    if (!lease) {
      return NextResponse.json(
        { success: false, error: "This operation is already running" },
        { status: 409, headers: { "Retry-After": "5" } }
      )
    }

    try {
    // Use service client for ALL operations to bypass any RLS silent failures
    const supabaseAdmin = await createServiceClient()

    // Fetch all pending messages for this site directly via inner join
    const { data: msgs, error: msgsError } = await supabaseAdmin
      .from("messages")
      .select("id, content, conversation_id, custom_data, agent_id, user_id, conversations!inner(site_id, is_archived, lead_id, channel, custom_data)")
      .eq("conversations.site_id", siteId)
      .eq("conversations.is_archived", false)
      .eq("custom_data->>status", "pending")
      .limit(MAX_MESSAGES + 1)

    if (msgsError) {
      console.error("Error fetching pending messages:", msgsError)
      return NextResponse.json({ success: false, error: msgsError.message }, { status: 500 })
    }

    const allMessages = msgs || []
    if (allMessages.length > MAX_MESSAGES) {
      return NextResponse.json(
        { success: false, error: `At most ${MAX_MESSAGES} messages can be processed at once` },
        { status: 413 }
      )
    }
    console.log(`Found ${allMessages.length} pending messages to accept for site ${siteId}`)

    if (allMessages.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0, conversationIds: [] })
    }

    // Step 2: bulk-update in batches using .eq("id", id).
    const now = new Date().toISOString()
    let failCount = 0

    for (let i = 0; i < allMessages.length; i += BATCH_SIZE) {
      const batch = allMessages.slice(i, i + BATCH_SIZE)

      const results = await Promise.all(
        batch.map((m: any) =>
          supabaseAdmin
            .from("messages")
            .update({
              custom_data: { ...(m.custom_data as Record<string, unknown>), status: "accepted" },
              updated_at: now,
            })
            .eq("id", m.id)
            .eq("custom_data->>status", "pending")
        )
      )

      results.forEach((r, idx) => {
        if (r.error) {
          console.error(
            `Message update error [id=${batch[idx].id}]:`,
            r.error.code,
            r.error.message,
            r.error.details,
            r.error.hint
          )
          failCount++
        }
      })
    }

    const conversationIds = [...new Set(allMessages.map((m: any) => m.conversation_id))]

    // Step 3: update status to 'active' for all affected conversations
    if (conversationIds.length > 0) {
      for (let i = 0; i < conversationIds.length; i += BATCH_SIZE) {
        const batch = conversationIds.slice(i, i + BATCH_SIZE)
        const { error } = await supabaseAdmin
          .from("conversations")
          .update({ status: "active" })
          .in("id", batch)
          
        if (error) {
          console.error("Error updating conversation status:", error.message)
        }
      }
    }

    if (failCount > 0) {
      return NextResponse.json(
        { success: false, error: `${failCount} message(s) failed to update` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      updatedCount: allMessages.length,
      conversationIds,
    })
    } finally {
      await lease.release()
    }
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 413 }
      )
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      )
    }
    console.error("Error in accept-all-pending:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
