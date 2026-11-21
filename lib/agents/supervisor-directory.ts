import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { eligibleSupervisorIds } from '@/app/agents/list/agent-supervisors'

const row = z.object({ id: z.string().uuid(), name: z.string(), role: z.string().nullable(), supervisor: z.string().uuid().nullable() })
type Row = z.infer<typeof row>
const option = ({ id, name, role }: Row) => ({ id, name, role })

export class SupervisorDirectoryError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

/** Never infer eligibility from a partial page or from an RLS-invisible ancestor. */
export async function readSupervisorDirectory(client: SupabaseClient, siteId: string, agentId?: string, signal?: AbortSignal) {
  const rows: Row[] = []
  const seen = new Set<string>()
  let total: number | null = null
  const pageSize = 250
  for (let page = 0; page < 100; page++) {
    const query = client.from('agents').select('id,name,role,supervisor', { count: 'exact' })
      .eq('site_id', siteId).order('id').range(rows.length, rows.length + pageSize - 1)
    const { data, error, count } = await (signal ? query.abortSignal(signal) : query)
    if (error || !Array.isArray(data) || count == null || (total !== null && total !== count)) break
    total = count
    for (const item of data) {
      const parsed = row.safeParse(item)
      if (!parsed.success || seen.has(parsed.data.id)) throw new SupervisorDirectoryError(503, 'Inconsistent supervisor directory')
      rows.push(parsed.data); seen.add(parsed.data.id)
    }
    if (rows.length === total) {
      const current = agentId ? rows.find(item => item.id === agentId) : undefined
      if (agentId && !current) throw new SupervisorDirectoryError(404, 'Agent unavailable')
      const eligible = eligibleSupervisorIds(rows, agentId)
      const previous = current?.supervisor ? rows.find(item => item.id === current.supervisor) : null
      return {
        agents: rows.filter(item => eligible.has(item.id)).map(option).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
        current: previous ? option(previous) : null,
      }
    }
    if (!data.length || rows.length > total) break
  }
  throw new SupervisorDirectoryError(503, 'Could not verify supervisor options')
}