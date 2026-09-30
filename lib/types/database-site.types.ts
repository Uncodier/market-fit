import type { CompetitorUrl, ResourceUrl } from "./database-domain.types"
import type { Json } from "./database.types"

export type SiteRow = {
  id: string
  created_at: string
  updated_at: string
  name: string
  url: string | null
  user_id: string
  description: string | null
  logo_url: string | null
  resource_urls: ResourceUrl[] | null
  competitors: CompetitorUrl[] | null
  focus_mode: number | null
  archived_at: string | null
  archived_by: string | null
  archive_snapshot: Json | null
}

export type SitesTable = {
  Row: SiteRow
  Insert: Partial<SiteRow> & Pick<SiteRow, "name" | "user_id">
  Update: Partial<SiteRow>
}