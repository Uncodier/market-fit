import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

function conversationFromJoin(conversations: unknown) {
  if (Array.isArray(conversations)) return conversations[0] as Record<string, any> | undefined
  return conversations as Record<string, any> | undefined
}

function resolveChannel(messageData: Record<string, any> | null | undefined, conversation?: Record<string, any>) {
  const fromMessage = messageData?.channel || messageData?.source
  const fromConversation = conversation?.channel || conversation?.custom_data?.channel
  return String(fromMessage || fromConversation || "").toLowerCase()
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { messageId } = body

    if (!messageId) {
      return NextResponse.json({ success: false, error: "Missing messageId" }, { status: 400 })
    }

    const supabaseAdmin = await createServiceClient()

    const { data: msg, error: msgError } = await supabaseAdmin
      .from("messages")
      .select("id, content, conversation_id, custom_data, agent_id, user_id, conversations!inner(site_id, lead_id, channel, custom_data)")
      .eq("id", messageId)
      .single()

    if (msgError || !msg) {
      console.error("Error fetching message:", msgError)
      return NextResponse.json({ success: false, error: "Message not found" }, { status: 404 })
    }

    const conversation = conversationFromJoin(msg.conversations)
    const siteId = conversation?.site_id
    const leadId = conversation?.lead_id

    if (!siteId) {
      return NextResponse.json({ success: false, error: "Conversation site not found" }, { status: 404 })
    }

    const { data: siteAccess, error: siteAccessError } = await supabase
      .from("sites")
      .select("id")
      .eq("id", siteId)
      .single()

    if (siteAccessError || !siteAccess) {
      console.error("User does not have access to site:", siteId)
      return NextResponse.json({ success: false, error: "Forbidden: You don't have permissions" }, { status: 403 })
    }

    const currentCustomData = (msg.custom_data as Record<string, any>) || {}
    const channel = resolveChannel(currentCustomData, conversation)

    const updatedCustomData = {
      ...currentCustomData,
      status: "accepted",
      ...(channel ? { channel } : {}),
    }

    const { error: updateError } = await supabaseAdmin
      .from("messages")
      .update({
        custom_data: updatedCustomData,
        updated_at: new Date().toISOString()
      })
      .eq("id", messageId)

    if (updateError) {
      console.error("Error updating message status:", updateError)
      return NextResponse.json({ success: false, error: "Failed to accept message" }, { status: 500 })
    }

    await supabaseAdmin
      .from("conversations")
      .update({ status: "active" })
      .eq("id", msg.conversation_id)

    return NextResponse.json({
      success: true,
      updatedCustomData
    })
  } catch (error) {
    console.error("Error in accept-message:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
