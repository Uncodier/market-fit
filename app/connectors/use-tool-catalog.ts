"use client"

import { z } from "zod"
import { useConnectorResource } from "./use-connector-resource"
import { exactToolIdPattern } from "./connector-request"
import { toolActionTypesSchema, type ToolAction } from "./tool-action-types"

const toolsSchema = z.object({
  items: z.array(z.object({ slug: z.string().regex(exactToolIdPattern), name: z.string(), description: z.string(),
    reviewed: z.boolean(), action_types: toolActionTypesSchema.optional() })),
  next_cursor: z.string().nullable(), total: z.number().int().nonnegative().nullable(),
  current_page: z.number().int().positive().optional(), total_pages: z.number().int().positive().nullable().optional(),
})

export function useToolCatalog(siteId: string, slug: string, page: number, search = "", action: ToolAction = "all") {
  const params = new URLSearchParams({ site_id: siteId, page: String(page) })
  if (search.trim()) params.set("q", search.trim())
  if (action !== "all") params.set("action", action)
  const resource = useConnectorResource(`/api/connectors/catalog/${encodeURIComponent(slug)}/tools?${params}`, toolsSchema)
  const data = resource.data
  const currentPage = data?.current_page ?? page
  const totalPages = data?.total_pages ?? (data?.total == null ? null : Math.max(1, Math.ceil(data.total / 20)))
  return { ...resource, currentPage, totalPages }
}

export type CatalogTool = z.infer<typeof toolsSchema>["items"][number]
