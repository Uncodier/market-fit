import { z } from "zod"

export const locationScopeTables = ["deals", "quotations", "subscriptions", "tasks", "conversations", "records", "sale_orders", "reservations"] as const
export const locationScopeTableSchema = z.enum(locationScopeTables)
export type LocationScopeTable = z.infer<typeof locationScopeTableSchema>
export const locationScopeLabels: Record<LocationScopeTable, string> = {
  deals: "Deals", quotations: "Quotations", subscriptions: "Subscriptions", tasks: "Tasks",
  conversations: "Conversations", records: "Records", sale_orders: "Orders", reservations: "Reservations",
}
export const locationScopeAssignmentSchema = z.object({
  table: locationScopeTableSchema, id: z.string().uuid(), locationId: z.string().uuid(),
}).strict()
export const locationScopeSavedSchema = z.object({
  table: locationScopeTableSchema, id: z.string().uuid(), site_id: z.string().uuid(), location_id: z.string().uuid(),
})
export const locationScopeListSchema = z.object({
  site_id: z.string().uuid(), table: locationScopeTableSchema, page: z.number().int().nonnegative(), hasMore: z.boolean(),
  records: z.array(z.object({ id: z.string().uuid(), label: z.string(), location_id: z.string().uuid().nullable() })),
  locations: z.array(z.object({ id: z.string().uuid(), name: z.string(), is_active: z.boolean().nullable() })),
})
export type LocationScopeList = z.infer<typeof locationScopeListSchema>