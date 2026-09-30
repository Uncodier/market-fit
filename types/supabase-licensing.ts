import type { Json } from "./supabase"

export type PartnerLicensesTable = {
        Row: {
          id: string
          license_key: string
          parent_license_key: string | null
          partner: string
          status: string
          plan_name: string
          user_id: string | null
          site_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          license_key: string
          parent_license_key?: string | null
          partner: string
          status: string
          plan_name: string
          user_id?: string | null
          site_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          license_key?: string
          parent_license_key?: string | null
          partner?: string
          status?: string
          plan_name?: string
          user_id?: string | null
          site_id?: string | null
          created_at?: string
          updated_at?: string
        }
      Relationships: []
}

export type ReferralCodesTable = {
        Row: {
          id: string
          code: string
          description: string | null
          is_active: boolean
          max_uses: number | null
          current_uses: number
          expires_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          description?: string | null
          is_active?: boolean
          max_uses?: number | null
          current_uses?: number
          expires_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          description?: string | null
          is_active?: boolean
          max_uses?: number | null
          current_uses?: number
          expires_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      Relationships: []
}

export type WaitlistTable = {
        Row: {
          id: string
          email: string
          name: string | null
          referral_code_attempted: string | null
          source: string
          status: "pending" | "approved" | "rejected" | "converted"
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          referral_code_attempted?: string | null
          source?: string
          status?: "pending" | "approved" | "rejected" | "converted"
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          referral_code_attempted?: string | null
          source?: string
          status?: "pending" | "approved" | "rejected" | "converted"
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      Relationships: []
}

export type ReferralCodeUsesTable = {
        Row: {
          id: string
          referral_code_id: string
          user_id: string
          used_at: string
        }
        Insert: {
          id?: string
          referral_code_id: string
          user_id: string
          used_at?: string
        }
        Update: {
          id?: string
          referral_code_id?: string
          user_id?: string
          used_at?: string
        }
      Relationships: []
}

