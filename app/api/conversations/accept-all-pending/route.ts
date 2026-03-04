import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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

    // Step 1: get pending conversation IDs for this site
    const { data: convRows, error: convError } = await supabase
      .from("conversations")
      .select("id")
      .eq("site_id", siteId)
      .eq("status", "pending")

    if (convError) {
      console.error("Error fetching pending conversations:", convError)
      return NextResponse.json({ success: false, error: convError.message }, { status: 500 })
    }

    if (!convRows || convRows.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0, conversationIds: [] })
    }

    const conversationIds = convRows.map((c) => c.id)

    // Step 2: fetch messages with custom_data.status = "pending" for those conversations.
    // Done in batches of BATCH_SIZE conversation IDs so .in() stays short.
    const allMessages: { id: string; custom_data: Record<string, unknown> }[] = []

    for (let i = 0; i < conversationIds.length; i += BATCH_SIZE) {
      const convBatch = conversationIds.slice(i, i + BATCH_SIZE)

      const { data: msgs, error: msgsError } = await supabase
        .from("messages")
        .select("id, custom_data")
        .in("conversation_id", convBatch)
        .eq("custom_data->>status", "pending")

      if (msgsError) {
        console.error("Error fetching messages batch:", msgsError)
        continue
      }
      if (msgs?.length) {
        allMessages.push(...(msgs as { id: string; custom_data: Record<string, unknown> }[]))
      }
    }

    if (allMessages.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0, conversationIds: [] })
    }

    // Step 3: bulk-update in batches using .in("id", batchIds).
    // Since we already have custom_data in memory, we can merge the status key
    // per message — but to avoid N individual updates we group them by identical
    // custom_data shape. In practice all these messages just need status → "accepted",
    // so we update each batch with a single .in() call per unique custom_data value.
    //
    // Simplest correct approach: one .in() update per batch, setting the full
    // custom_data object. Because all messages in this batch have status="pending"
    // and we're only changing that one key, we build the merged object per message
    // and run them in parallel — still server-side, no URL length issue.
    const now = new Date().toISOString()
    let failCount = 0

    for (let i = 0; i < allMessages.length; i += BATCH_SIZE) {
      const batch = allMessages.slice(i, i + BATCH_SIZE)

      const results = await Promise.all(
        batch.map((m) =>
          supabase
            .from("messages")
            .update({
              custom_data: { ...m.custom_data, status: "accepted" },
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
