export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

import type { SegmentsTable, AgentsTable, AgentAssetsTable, ContentAssetsTable, AssetsTable, CommandsTable } from "./supabase-workspace"
import type { ConversationsTable, MessagesTable, ProfilesTable } from "./supabase-chat"
import type { TasksTable, TaskCommentsTable, LeadsTable, CategoriesTable } from "./supabase-tasks"
import type { ContentTable, RequirementsTable, RequirementStatusesTable, CampaignsTable } from "./supabase-content"
import type { PartnerLicensesTable, ReferralCodesTable, WaitlistTable, ReferralCodeUsesTable } from "./supabase-licensing"

export interface Database {
  public: {
    Tables: {
      content: ContentTable
      requirements: RequirementsTable
      requirement_status: RequirementStatusesTable
      campaigns: CampaignsTable
      tasks: TasksTable
      task_comments: TaskCommentsTable
      leads: LeadsTable
      categories: CategoriesTable
      profiles: ProfilesTable
      segments: SegmentsTable
      agents: AgentsTable
      agent_assets: AgentAssetsTable
      content_assets: ContentAssetsTable
      assets: AssetsTable
      commands: CommandsTable
      conversations: ConversationsTable
      messages: MessagesTable
      partner_licenses: PartnerLicensesTable
      referral_codes: ReferralCodesTable
      waitlist: WaitlistTable
      referral_code_uses: ReferralCodeUsesTable
    }
    Views: { [_ in never]: never }
    Functions: {
      reorder_task_priorities: {
        Args: { p_task_id: string; p_new_position: number; p_status: string; p_site_id: string }
        Returns: undefined
      }
    }
    Enums: { [_ in never]: never }
  }
}
