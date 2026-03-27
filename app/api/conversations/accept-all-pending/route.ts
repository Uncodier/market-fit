import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

const BATCH_SIZE = 200

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { siteId } = body

    if (!siteId) {
      return NextResponse.json({ success: false, error: "Missing siteId" }, { status: 400 })
    }

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

    // Use service client for ALL operations to bypass any RLS silent failures
    const supabaseAdmin = await createServiceClient()

    // Fetch all pending messages for this site directly via inner join
    const { data: msgs, error: msgsError } = await supabaseAdmin
      .from("messages")
      .select("id, conversation_id, custom_data, conversations!inner(site_id, is_archived)")
      .eq("conversations.site_id", siteId)
      .eq("conversations.is_archived", false)
      .eq("custom_data->>status", "pending")

    if (msgsError) {
      console.error("Error fetching pending messages:", msgsError)
      return NextResponse.json({ success: false, error: msgsError.message }, { status: 500 })
    }

    const allMessages = msgs || []
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
        batch.map((m) =>
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

    const conversationIds = [...new Set(allMessages.map(m => m.conversation_id))]

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
  } catch (error) {
    console.error("Error in accept-all-pending:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
