export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      content: {
        Row: {
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
        Insert: {
          id?: string
          title: string
          description?: string | null
          content_type: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page"
          status: "draft" | "review" | "approved" | "published" | "archived"
          segment_id?: string | null
          site_id: string
          author_id?: string | null
          user_id?: string | null
          created_at?: string
          updated_at?: string
          published_at?: string | null
          tags?: string[] | null
          estimated_reading_time?: number | null
          word_count?: number | null
          seo_score?: number | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          content_type?: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page"
          status?: "draft" | "review" | "approved" | "published" | "archived"
          segment_id?: string | null
          site_id?: string
          author_id?: string | null
          user_id?: string | null
          created_at?: string
          updated_at?: string
          published_at?: string | null
          tags?: string[] | null
          estimated_reading_time?: number | null
          word_count?: number | null
          seo_score?: number | null
        }
      }
      experiments: {
        Row: {
          id: string
          name: string
          description: string
          preview_url: string
          hypothesis: string
          status: "draft" | "active" | "completed"
          user_id: string
          site_id: string
          start_date: string | null
          end_date: string | null
          conversion: number | null
          roi: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          preview_url: string
          hypothesis: string
          status: "draft" | "active" | "completed"
          user_id: string
          site_id: string
          start_date?: string | null
          end_date?: string | null
          conversion?: number | null
          roi?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          preview_url?: string
          hypothesis?: string
          status?: "draft" | "active" | "completed"
          user_id?: string
          site_id?: string
          start_date?: string | null
          end_date?: string | null
          conversion?: number | null
          roi?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      experiment_segments: {
        Row: {
          experiment_id: string
          segment_id: string
          created_at: string
        }
        Insert: {
          experiment_id: string
          segment_id: string
          created_at?: string
        }
        Update: {
          experiment_id?: string
          segment_id?: string
          created_at?: string
        }
      }
      segments: {
        Row: {
          id: string
          name: string
          description: string
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 