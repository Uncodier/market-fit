"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

export interface ContentItem {
  id: string
  title: string
  description: string | null
  content_type: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page"
  status: "draft" | "review" | "approved" | "published" | "archived"
  segment_id: string | null
  site_id: string
  author_id: string | null
  user_id: string | null
  created_at: string
  updated_at: string
  published_at: string | null
  tags: string[] | null
  estimated_reading_time: number | null
  word_count: number | null
  seo_score: number | null
}

export interface ContentResponse {
  content: ContentItem[] | null
  error: string | null
  count: number
}

export async function getContent(siteId: string): Promise<ContentResponse> {
  try {
    // Use service client to bypass RLS
    const supabase = await createServiceClient()

    // Check current user ID for debugging
    const authClient = await createClient()
    const { data: userData } = await authClient.auth.getUser()
    console.log("Current user ID:", userData.user?.id)

    // Log site ID
    console.log("Fetching content for site ID:", siteId)

    const { data, error, count } = await supabase
      .from("content")
      .select("*", { count: "exact" })
      .eq("site_id", siteId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching content:", error)
      return { content: null, error: error.message, count: 0 }
    }

    // Log content count
    console.log(`Found ${data?.length || 0} content items for site ${siteId}`)
    
    // Debug: Log the first item if it exists
    if (data && data.length > 0) {
      console.log("First content item:", {
        id: data[0].id,
        title: data[0].title,
        site_id: data[0].site_id,
        user_id: data[0].user_id,
        author_id: data[0].author_id
      })
    }

    return { 
      content: data as ContentItem[], 
      error: null, 
      count: count || 0 
    }
  } catch (error) {
    console.error("Error in getContent:", error)
    return { 
      content: null, 
      error: "Failed to fetch content items", 
      count: 0 
    }
  }
}

export async function createContent(data: {
  title: string
  description?: string
  content_type: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page"
  segment_id?: string
  site_id: string
  author_id?: string
  tags?: string[]
}) {
  try {
    // First get the current user ID
    const authClient = await createClient()
    const { data: userData } = await authClient.auth.getUser()
    const userId = userData.user?.id
    
    // Debug logging
    console.log("Creating content with:", {
      title: data.title,
      site_id: data.site_id,
      user_id: userId
    })
    
    if (!userId) {
      console.error("No authenticated user found")
      return { error: "User must be authenticated to create content" }
    }
    
    // Verify site permissions
    const { data: permissions } = await authClient
      .from("site_permissions")
      .select("*")
      .eq("user_id", userId)
      .eq("site_id", data.site_id)
      .single()
    
    console.log("User permissions for site:", permissions)
    
    // Use service client to bypass RLS for insert operation
    const supabase = await createServiceClient()
    
    const contentData = {
      title: data.title,
      description: data.description || null,
      content_type: data.content_type,
      status: "draft",
      segment_id: data.segment_id || null,
      site_id: data.site_id,
      // Always set the current user's ID as both author_id and user_id
      author_id: userId,
      user_id: userId,
      tags: data.tags || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    console.log("Inserting content with data:", contentData)
    
    const { error, data: newContent } = await supabase
      .from("content")
      .insert(contentData)
      .select()
      .single()

    if (error) {
      console.error("Error creating content:", error)
      return { error: error.message }
    }
    
    console.log("Content created successfully:", newContent.id)

    revalidatePath("/content")
    return { success: true, content: newContent }
  } catch (error) {
    console.error("Error in createContent:", error)
    return { error: "Failed to create content item" }
  }
}

export async function updateContentStatus(data: {
  contentId: string
  status: "draft" | "review" | "approved" | "published" | "archived"
}) {
  try {
    const supabase = await createServiceClient()

    const { error } = await supabase
      .from("content")
      .update({ 
        status: data.status,
        updated_at: new Date().toISOString(),
        ...(data.status === "published" ? { published_at: new Date().toISOString() } : {})
      })
      .eq("id", data.contentId)

    if (error) {
      console.error("Error updating content status:", error)
      return { error: error.message }
    }

    revalidatePath("/content")
    return { success: true }
  } catch (error) {
    console.error("Error in updateContentStatus:", error)
    return { error: "Failed to update content status" }
  }
}

export async function updateContent(data: {
  contentId: string
  title?: string
  description?: string
  content_type?: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page"
  segment_id?: string | null
  tags?: string[] | null
  estimated_reading_time?: number | null
  word_count?: number | null
  seo_score?: number | null
}) {
  try {
    const supabase = await createServiceClient()

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // Only include fields that are provided
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.content_type !== undefined) updateData.content_type = data.content_type
    if (data.segment_id !== undefined) updateData.segment_id = data.segment_id
    if (data.tags !== undefined) updateData.tags = data.tags
    if (data.estimated_reading_time !== undefined) updateData.estimated_reading_time = data.estimated_reading_time
    if (data.word_count !== undefined) updateData.word_count = data.word_count
    if (data.seo_score !== undefined) updateData.seo_score = data.seo_score

    const { error } = await supabase
      .from("content")
      .update(updateData)
      .eq("id", data.contentId)

    if (error) {
      console.error("Error updating content:", error)
      return { error: error.message }
    }

    revalidatePath("/content")
    return { success: true }
  } catch (error) {
    console.error("Error in updateContent:", error)
    return { error: "Failed to update content" }
  }
} 