import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"

// Schema for create notification
const CreateNotificationSchema = z.object({
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  type: z.enum(["info", "success", "warning", "error"]).default("info"),
  site_id: z.string().min(1, "Site ID is required"),
  user_id: z.string().min(1, "User ID is required")
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify session exists
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    
    // Parse request body
    const body = await request.json()
    
    try {
      // Validate input data
      const validatedData = CreateNotificationSchema.parse({
        ...body,
        read: false // Always set new notifications as unread
      })
      
      // Insert the notification
      const { data, error } = await supabase
        .from("notifications")
        .insert([validatedData])
        .select()
        .single()
      
      if (error) {
        console.error("Error creating notification:", error)
        return NextResponse.json(
          { error: `Error creating notification: ${error.message}` },
          { status: 500 }
        )
      }
      
      return NextResponse.json({ notification: data })
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(e => `${e.path}: ${e.message}`).join(", ")
        return NextResponse.json(
          { error: `Validation errors: ${errors}` },
          { status: 400 }
        )
      }
      
      throw error
    }
  } catch (error) {
    console.error("Error in notifications API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify session exists
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    
    // Get site_id and user_id from query params
    const { searchParams } = new URL(request.url)
    const site_id = searchParams.get("site_id")
    const user_id = searchParams.get("user_id") || session.user.id
    
    if (!site_id) {
      return NextResponse.json(
        { error: "Missing site_id parameter" },
        { status: 400 }
      )
    }
    
    // Query notifications
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq('site_id', site_id)
      .eq('user_id', user_id)
      .order("created_at", { ascending: false })
    
    if (error) {
      console.error("Error fetching notifications:", error)
      return NextResponse.json(
        { error: `Error fetching notifications: ${error.message}` },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ notifications: data || [] })
  } catch (error) {
    console.error("Error in notifications API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify session exists
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    
    // Parse request body
    const body = await request.json()
    
    // Check if it's a mark all as read operation
    if (body.markAllAsRead) {
      const site_id = body.site_id
      const user_id = body.user_id || session.user.id
      
      if (!site_id) {
        return NextResponse.json(
          { error: "Missing site_id parameter" },
          { status: 400 }
        )
      }
      
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("site_id", site_id)
        .eq("user_id", user_id)
        .eq("read", false)
      
      if (error) {
        console.error("Error marking all notifications as read:", error)
        return NextResponse.json(
          { error: `Error marking all notifications as read: ${error.message}` },
          { status: 500 }
        )
      }
      
      return NextResponse.json({ success: true })
    } 
    // Individual notification update
    else if (body.id) {
      const { error } = await supabase
        .from("notifications")
        .update({ read: body.read })
        .eq("id", body.id)
      
      if (error) {
        console.error("Error updating notification:", error)
        return NextResponse.json(
          { error: `Error updating notification: ${error.message}` },
          { status: 500 }
        )
      }
      
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Error in notifications API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify session exists
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    
    // Get parameters from the URL
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const site_id = searchParams.get("site_id")
    const user_id = searchParams.get("user_id") || session.user.id
    
    // Delete single notification
    if (id) {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id)
      
      if (error) {
        console.error("Error deleting notification:", error)
        return NextResponse.json(
          { error: `Error deleting notification: ${error.message}` },
          { status: 500 }
        )
      }
      
      return NextResponse.json({ success: true })
    } 
    // Delete all notifications for a user in a site
    else if (site_id && user_id) {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("site_id", site_id)
        .eq("user_id", user_id)
      
      if (error) {
        console.error("Error deleting all notifications:", error)
        return NextResponse.json(
          { error: `Error deleting all notifications: ${error.message}` },
          { status: 500 }
        )
      }
      
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Error in notifications API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 