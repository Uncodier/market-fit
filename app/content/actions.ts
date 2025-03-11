"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

export interface ContentItem {
  id: string
  title: string
  description: string | null
  content_type: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page"
  status: "draft" | "review" | "approved" | "published" | "archived"
  segment_id: string | null
  author_id: string | null
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
    const supabase = await createClient()

    const { data, error, count } = await supabase
      .from("content")
      .select("*", { count: "exact" })
      .eq("site_id", siteId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching content:", error)
      return { content: null, error: error.message, count: 0 }
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
    const supabase = await createClient()

    const { error } = await supabase.from("content").insert({
      title: data.title,
      description: data.description || null,
      content_type: data.content_type,
      status: "draft",
      segment_id: data.segment_id || null,
      site_id: data.site_id,
      author_id: data.author_id || null,
      tags: data.tags || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    if (error) {
      console.error("Error creating content:", error)
      return { error: error.message }
    }

    revalidatePath("/content")
    return { success: true }
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
    const supabase = await createClient()

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
    const supabase = await createClient()

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