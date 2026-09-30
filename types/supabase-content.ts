import type { Json } from "./supabase"
import type { CampaignData } from "@/app/types/campaigns"

type ContentRow = {
  id: string
  site_id: string
  title: string
  description: string | null
  status: string
  type: string
  created_at: string
}

export type ContentTable = {
  Row: ContentRow
  Insert: Pick<ContentRow, "site_id" | "title" | "type"> & Partial<ContentRow>
  Update: Partial<ContentRow>
  Relationships: []
}

type RequirementRow = {
  id: string
  site_id: string
  title: string
  description: string | null
  status: string
  priority: string
  completion_status: string
  created_at: string
  backlog: Json
}

export type RequirementsTable = {
  Row: RequirementRow
  Insert: Pick<RequirementRow, "site_id" | "title"> & Partial<RequirementRow>
  Update: Partial<RequirementRow>
  Relationships: []
}

type RequirementStatusRow = {
  id: string
  site_id: string
  instance_id: string | null
  asset_id: string | null
  requirement_id: string | null
  repo_url: string | null
  source_code: string | null
  preview_url: string | null
  endpoint_url: string | null
  stage: string | null
  message: string | null
  cycle: number | null
  snapshot_id: string | null
  active_sandbox_id: string | null
  created_at: string
  updated_at: string
}

export type RequirementStatusesTable = {
  Row: RequirementStatusRow
  Insert: Pick<RequirementStatusRow, "site_id"> & Partial<RequirementStatusRow>
  Update: Partial<RequirementStatusRow>
  Relationships: [{
    foreignKeyName: "requirement_status_requirement_id_fkey"
    columns: ["requirement_id"]
    isOneToOne: false
    referencedRelation: "requirements"
    referencedColumns: ["id"]
  }]
}

export type CampaignsTable = {
  Row: { [Key in keyof CampaignData]: CampaignData[Key] }
  Insert: Pick<CampaignData, "site_id" | "user_id" | "title"> & Partial<CampaignData>
  Update: Partial<CampaignData>
  Relationships: []
}