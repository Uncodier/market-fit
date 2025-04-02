"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

export type ContentItem = {
  id: string
  title: string
  description: string | null
  content_type: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page"
  content: string | null
  text: string | null
  status: string
  segment_id: string | null
  site_id: string
  author_id: string | null
  user_id: string | null
  created_at: string
  updated_at: string
  published_at: string | null
  tags: string[] | null
  word_count: number | null
  estimated_reading_time: number | null
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

export async function createContent({
  siteId,
  title,
  description,
  content_type,
  segment_id,
  tags,
  content
}: {
  siteId: string
  title: string
  description?: string
  content_type: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page"
  segment_id?: string | null
  tags?: string[] | null
  content?: string
}) {
  try {
    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('content')
      .insert({
        site_id: siteId,
        title,
        description,
        content_type,
        segment_id,
        tags,
        content,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error("Error creating content:", error)
      return { error: error.message }
    }
    
    revalidatePath("/content")
    return { content: data }
  } catch (error) {
    console.error("Error creating content:", error)
    return { error: "Failed to create content" }
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

export async function updateContent({
  contentId,
  title,
  description,
  content_type,
  segment_id,
  tags,
  content,
  text
}: {
  contentId: string
  title: string
  description?: string
  content_type: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page"
  segment_id?: string | null
  tags?: string[] | null
  content?: string
  text?: string
}) {
  try {
    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('content')
      .update({
        title,
        description,
        content_type,
        segment_id,
        tags,
        text,
        updated_at: new Date().toISOString()
      })
      .eq('id', contentId)
      .select()
      .single()
    
    if (error) {
      console.error("Error updating content:", error)
      return { error: error.message }
    }
    
    revalidatePath("/content")
    return { content: data }
  } catch (error) {
    console.error("Error updating content:", error)
    return { error: "Failed to update content" }
  }
}

export async function getContentById(contentId: string): Promise<{ content: ContentItem | null; error: string | null }> {
  try {
    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single()
    
    if (error) {
      console.error("Error fetching content:", error)
      return { content: null, error: error.message }
    }
    
    return { content: data as ContentItem, error: null }
  } catch (error) {
    console.error("Error in getContentById:", error)
    return { content: null, error: "Failed to fetch content" }
  }
} 