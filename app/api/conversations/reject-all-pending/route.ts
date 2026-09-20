import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { acquireOperationLease } from "@/lib/redis/operation-lease"
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from "@/lib/http/read-limited-request-body"
import { z } from "zod"

const BATCH_SIZE = 200
const COUNT_CONCURRENCY = 20
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
      "reject-all-pending",
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

    // Fetch all pending and accepted messages directly using inner join
    const { data: msgs, error: msgsError } = await supabaseAdmin
      .from("messages")
      .select("id, conversation_id, custom_data, conversations!inner(site_id, is_archived)")
      .eq("conversations.site_id", siteId)
      .eq("conversations.is_archived", false)
      .or("custom_data->>status.eq.pending,custom_data->>status.eq.accepted")
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
    console.log(`Found ${allMessages.length} unsent messages to reject for site ${siteId}`)

    if (allMessages.length === 0) {
      return NextResponse.json({ success: true, deletedMessages: 0, deletedConversations: 0, conversationsToDelete: [] })
    }

    // Step 3: delete unsent messages in batches using admin client
    const messageIds = allMessages.map((m: any) => m.id)
    let totalDeletedMessages = 0

    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const batch = messageIds.slice(i, i + BATCH_SIZE)
      const { data, error } = await supabaseAdmin
        .from("messages")
        .delete()
        .in("id", batch)
        .select("id")
        
      if (error) {
        console.error("Error deleting messages batch:", error.message)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }
      
      if (data) {
        totalDeletedMessages += data.length
      }
    }

    // Step 4: check which affected conversations are now empty — in parallel batches
    const affectedConvIds = [
      ...new Set<string>(
        allMessages.map((m: any) => String(m.conversation_id))
      ),
    ]
    const conversationsToDelete: string[] = []

    for (let i = 0; i < affectedConvIds.length; i += COUNT_CONCURRENCY) {
      const batch = affectedConvIds.slice(i, i + COUNT_CONCURRENCY)
      const countResults = await Promise.all(
        batch.map((convId) =>
          supabaseAdmin
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", convId)
        )
      )

      countResults.forEach((res, idx) => {
        if (!res.error && (res.count ?? 0) === 0) {
          conversationsToDelete.push(batch[idx])
        }
      })
    }

    const conversationsToUpdate = affectedConvIds.filter(id => !conversationsToDelete.includes(id))

    // Step 5: delete empty conversations in batches using admin client
    let totalDeletedConversations = 0
    if (conversationsToDelete.length > 0) {
      for (let i = 0; i < conversationsToDelete.length; i += BATCH_SIZE) {
        const batch = conversationsToDelete.slice(i, i + BATCH_SIZE)
        const { data, error } = await supabaseAdmin
          .from("conversations")
          .delete()
          .in("id", batch)
          .select("id")
          
        if (error) {
          console.error("Error deleting empty conversations:", error.message)
        } else if (data) {
          totalDeletedConversations += data.length
        }
      }
    }

    // Step 6: update status to 'active' for non-empty affected conversations
    if (conversationsToUpdate.length > 0) {
      for (let i = 0; i < conversationsToUpdate.length; i += BATCH_SIZE) {
        const batch = conversationsToUpdate.slice(i, i + BATCH_SIZE)
        const { error } = await supabaseAdmin
          .from("conversations")
          .update({ status: "active" })
          .in("id", batch)
          
        if (error) {
          console.error("Error updating conversation status:", error.message)
        }
      }
    }

    return NextResponse.json({
      success: true,
      deletedMessages: totalDeletedMessages,
      deletedConversations: totalDeletedConversations,
      conversationsToDelete,
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
    console.error("Error in reject-all-pending:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
