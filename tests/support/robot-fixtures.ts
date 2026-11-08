import type { Page, Route } from '@playwright/test'
import { bindBrowserFixture, fixtureClient } from './mutation-fixtures'
import { fixtureConnection, requireUuid } from './mutation-safety'

type Context = { get(key: string): unknown; set(key: string, value: unknown): void }
type Owned = { id: string; siteId: string; userId: string }
type Journal = { entries: Owned[]; errors: string[]; pattern: string; handler: (route: Route) => Promise<void> }

export function validateCreation(body: unknown, siteId: string, userId: string): Owned {
  const rows = Array.isArray(body) ? body : [body]
  if (rows.length !== 1) throw new Error('Expected one robot insertion')
  const row = rows[0]
  if (!row || row.site_id !== siteId || row.user_id !== userId || row.created_by !== userId ||
      row.name !== 'Assistant Session' || row.status !== 'pending' || row.instance_type !== 'ubuntu') {
    throw new Error('Robot insertion does not match the bound placeholder owner')
  }
  return { id: requireUuid(row.id, 'Robot creation ID'), siteId, userId }
}

/** Observe and forward the real insert unchanged; never synthesize a backend response. */
export async function prepare(page: Page, context: Context) {
  await bindBrowserFixture(page)
  const { client, siteId, userId } = await fixtureClient()
  const pattern = `${fixtureConnection().url}/rest/v1/remote_instances*`
  const journal: Journal = { entries: [], errors: [], pattern, handler: async () => {} }
  journal.handler = async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return }
    try {
      const owned = validateCreation(route.request().postDataJSON(), siteId, userId)
      if (journal.entries.some(entry => entry.id === owned.id)) throw new Error('Duplicate robot creation attempt')
      const before = await client.from('remote_instances').select('id').eq('id', owned.id)
      if (before.error || before.data?.length !== 0) throw new Error('Robot ID is not verifiably new')
      // Register before forwarding, even if the browser never receives a response.
      journal.entries.push(owned)
      await route.continue()
    } catch {
      journal.errors.push('Robot insertion correlation failed; request refused')
      await route.abort('blockedbyclient')
    }
  }
  context.set('robotJournal', journal)
  await page.route(pattern, journal.handler)
}

export function createdId(context: Context, previousCount: number) {
  const journal = context.get('robotJournal') as Journal
  if (journal.errors.length) throw new Error(journal.errors.join('; '))
  if (journal.entries.length !== previousCount + 1) throw new Error('Expected exactly one new robot')
  return journal.entries[previousCount].id
}
export function count(context: Context) { return (context.get('robotJournal') as Journal).entries.length }

async function readOwned(entry: Owned) {
  const { client, siteId, userId } = await fixtureClient()
  if (siteId !== entry.siteId || userId !== entry.userId) throw new Error('Robot fixture identity changed')
  const result = await client.from('remote_instances').select('id,site_id,user_id,created_by,name')
    .eq('id', entry.id).eq('site_id', siteId)
  if (result.error || !result.data || result.data.length > 1) throw new Error('Unable to verify exact robot')
  const row = result.data[0]
  if (row && (row.user_id !== userId || row.created_by !== userId)) throw new Error('Robot ownership changed; refusing deletion')
  return row
}
function entryFor(context: Context, id: string) {
  const entry = (context.get('robotJournal') as Journal).entries.find(item => item.id === id)
  if (!entry) throw new Error('Robot ID is not run-owned')
  return entry
}
export async function assertPersisted(context: Context, id: string, name: string) {
  const row = await readOwned(entryFor(context, id))
  if (!row || row.name !== name) throw new Error('Robot name did not persist')
}
export async function assertRemoved(context: Context, id: string) {
  if (await readOwned(entryFor(context, id))) throw new Error('Robot deletion did not persist')
}

export async function cleanup(page: Page, context: Context) {
  const journal = context.get('robotJournal') as Journal | undefined
  if (!journal) return
  // Leave Robots before deletion so the empty-workspace effect cannot create another session.
  await page.goto('/projects?manage=1')
  await bindBrowserFixture(page)
  const failures = [...journal.errors]
  for (const entry of [...journal.entries].reverse()) {
    try {
      if (!await readOwned(entry)) continue
      const response = await page.request.post('/api/robots/instance/delete', {
        headers: { Origin: new URL(page.url()).origin },
        data: { instance_id: entry.id, delete_requirements: true }, timeout: 600_000,
      })
      const body = await response.json().catch(() => null)
      if (!response.ok() || body?.success !== true || body.instance_id !== entry.id ||
          !Array.isArray(body.deleted_requirement_ids)) throw new Error('Robot cleanup API did not confirm deletion')
      await assertRemoved(context, entry.id)
    } catch { failures.push(`Exact robot cleanup failed: ${entry.id}`) }
  }
  await page.unroute(journal.pattern, journal.handler)
  if (failures.length) throw new Error(failures.join('; '))
}
