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

    // Step 1: get all non-archived conversation IDs for this site
    const { data: convRows, error: convError } = await supabase
      .from("conversations")
      .select("id")
      .eq("site_id", siteId)
      .eq("is_archived", false)

    if (convError) {
      console.error("Error fetching conversations:", convError)
      return NextResponse.json({ success: false, error: convError.message }, { status: 500 })
    }

    if (!convRows || convRows.length === 0) {
      return NextResponse.json({ success: true, deletedMessages: 0, deletedConversations: 0, conversationsToDelete: [] })
    }

    const allConvIds = convRows.map((c) => c.id)

    // Step 2: fetch messages with custom_data.status = "pending" or "accepted"
    // in batches of conversation IDs to avoid URL length issues
    const unsentMessages: { id: string; conversation_id: string }[] = []

    for (let i = 0; i < allConvIds.length; i += BATCH_SIZE) {
      const convBatch = allConvIds.slice(i, i + BATCH_SIZE)

      const [pendingRes, acceptedRes] = await Promise.all([
        supabase
          .from("messages")
          .select("id, conversation_id")
          .in("conversation_id", convBatch)
          .eq("custom_data->>status", "pending"),
        supabase
          .from("messages")
          .select("id, conversation_id")
          .in("conversation_id", convBatch)
          .eq("custom_data->>status", "accepted"),
      ])

      if (pendingRes.error) console.error("Pending fetch error:", pendingRes.error.message)
      if (acceptedRes.error) console.error("Accepted fetch error:", acceptedRes.error.message)

      const combined = [...(pendingRes.data ?? []), ...(acceptedRes.data ?? [])]
      // Deduplicate by id
      combined.forEach((m) => {
        if (!unsentMessages.some((x) => x.id === m.id)) {
          unsentMessages.push(m)
        }
      })
    }

    if (unsentMessages.length === 0) {
      return NextResponse.json({ success: true, deletedMessages: 0, deletedConversations: 0, conversationsToDelete: [] })
    }

    // Step 3: delete unsent messages in batches
    const messageIds = unsentMessages.map((m) => m.id)

    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const batch = messageIds.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from("messages").delete().in("id", batch)
      if (error) {
        console.error("Error deleting messages batch:", error.message)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }
    }

    // Step 4: check which affected conversations are now empty — in parallel batches
    const affectedConvIds = [...new Set(unsentMessages.map((m) => m.conversation_id))]
    const conversationsToDelete: string[] = []

    const countResults = await Promise.all(
      affectedConvIds.map((convId) =>
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", convId)
      )
    )

    countResults.forEach((res, idx) => {
      if (!res.error && (res.count ?? 0) === 0) {
        conversationsToDelete.push(affectedConvIds[idx])
      }
    })

    // Step 5: delete empty conversations in batches
    if (conversationsToDelete.length > 0) {
      for (let i = 0; i < conversationsToDelete.length; i += BATCH_SIZE) {
        const batch = conversationsToDelete.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from("conversations").delete().in("id", batch)
        if (error) {
          console.error("Error deleting empty conversations:", error.message)
        }
      }
    }

    return NextResponse.json({
      success: true,
      deletedMessages: messageIds.length,
      deletedConversations: conversationsToDelete.length,
      conversationsToDelete,
    })
  } catch (error) {
    console.error("Error in reject-all-pending:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
