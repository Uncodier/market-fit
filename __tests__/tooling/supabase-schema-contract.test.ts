/** @jest-environment node */

import type { Database } from "@/types/supabase"

type TableContract = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: { foreignKeyName: string; columns: string[]; referencedRelation: string; referencedColumns: string[] }[]
}

// A single interface-shaped Row without an index signature collapses the
// Supabase generic schema to never, breaking every table in that client.
const schemaIsValid: Database["public"] extends {
  Tables: Record<string, TableContract>
  Views: Record<string, unknown>
  Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
} ? true : false = true

it("preserves Supabase's table and RPC generic contract", () => {
  expect(schemaIsValid).toBe(true)
})