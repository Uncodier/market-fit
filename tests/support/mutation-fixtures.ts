import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'
import { fixtureConnection, requireUuid } from './mutation-safety'

// The only database mutation here is cleanup of exact run-owned records.
// Provisioning is deliberately unsupported: missing fixtures fail closed.
const entities = {
  campaign: ['campaigns', 'title'], deal: ['deals', 'name'],
  transaction: ['transactions', 'description'], bill: ['purchases', 'title'],
  quotation: ['quotations', 'notes'], priceList: ['price_lists', 'name'],
  modifierGroup: ['modifier_groups', 'name'], segment: ['segments', 'name'],
  task: ['tasks', 'title'], lead: ['leads', 'name'],
  catalog: ['catalog_items', 'name'],
  content: ['content', 'title'], requirement: ['requirements', 'title'],
  record: ['records', 'title'], promotion: ['promotions', 'name'], sale: ['sales', 'title'],
} as const
type Kind = keyof typeof entities
type Owned = { kind: Kind; names: string[]; id?: string; createdUrl?: string; creationAttempted?: boolean }
type Context = { get(key: string): any; set(key: string, value: any): void }

export async function fixtureClient(env: Record<string, string | undefined> = process.env) {
  const config = fixtureConnection(env)
  const client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email: config.email, password: config.password })
  if (error || !data.user || data.user.email?.toLowerCase() !== config.email.toLowerCase()) {
    throw new Error('Disposable fixture account authentication failed')
  }
  const siteId = config.environment.siteId
  const site = await client.from('sites').select('id,name,user_id').eq('id', siteId).single()
  if (site.error || !site.data || site.data.name !== config.environment.siteName) {
    throw new Error('Configured fixture site is unavailable or its name does not match TEST_SITE_NAME')
  }
  if (site.data.user_id !== data.user.id) {
    const member = await client.from('site_members').select('role')
      .eq('site_id', siteId).eq('user_id', data.user.id).single()
    if (member.error || member.data?.role !== 'admin') throw new Error('Fixture account requires owner/admin access')
  }
  return { client, siteId, userId: data.user.id }
}

/** Bind the UI session to the same backend/account as the cleanup client. */
export async function bindBrowserFixture(page: Page, env: Record<string, string | undefined> = process.env) {
  const config = fixtureConnection(env)
  const { client, userId } = await fixtureClient(env)
  const prefix = `sb-${new URL(config.url).hostname.split('.')[0]}-auth-token`
  const cookies = (await page.context().cookies()).filter(cookie => cookie.name === prefix || cookie.name.startsWith(`${prefix}.`))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const raw = cookies.length ? cookies.map(cookie => cookie.value).join('')
    : await page.evaluate(key => localStorage.getItem(key), prefix)
  if (!raw) throw new Error('UI auth session does not belong to TEST_SUPABASE_URL')
  let token: string
  try {
    const session = JSON.parse(raw.startsWith('base64-') ? Buffer.from(raw.slice(7), 'base64url').toString() : raw)
    token = session.access_token
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    if (new URL(payload.iss).origin !== config.url) throw new Error('Backend mismatch')
  } catch { throw new Error('Unable to bind UI auth to the explicitly selected fixture backend') }
  const user = await client.auth.getUser(token)
  if (user.error || user.data.user?.id !== userId) throw new Error('UI and fixture cleanup accounts do not match')
}

export function own(context: Context, kind: Kind, names: string[]) {
  if (!(kind in entities) || names.length === 0 || names.some(name => !/^Shiplight .+ \d{13}-[a-z0-9]+(?: Edited)?$/.test(name))) {
    throw new Error('Cleanup registration requires exact run-specific names')
  }
  const journal: Owned[] = context.get('mutationJournal') || []
  journal.push({ kind, names })
  context.set('mutationJournal', journal)
}

export function rememberCreatedRecord(context: Context, url: string) {
  const pathname = new URL(url).pathname
  const id = requireUuid(pathname.replace(/^\/records\//, ''), 'Created record ID')
  const entry = (context.get('mutationJournal') as Owned[]).find(item => item.kind === 'record')
  if (!entry) throw new Error('Missing record cleanup registration')
  entry.id = id
  entry.createdUrl = url
}

export function beginRecordCreation(context: Context) {
  const entry = (context.get('mutationJournal') as Owned[]).find(item => item.kind === 'record')
  if (!entry) throw new Error('Missing record cleanup registration')
  entry.creationAttempted = true
}

export async function remember(context: Context, kind: Kind, env: Record<string, string | undefined> = process.env) {
  const entry = (context.get('mutationJournal') as Owned[]).find(item => item.kind === kind)
  if (!entry) throw new Error('Missing cleanup registration')
  const { client, siteId } = await fixtureClient(env)
  const [table, field] = entities[kind]
  const result = await client.from(table).select(`id,${field}`).eq('site_id', siteId).in(field, entry.names)
  if (result.error || result.data?.length !== 1) throw new Error(`Expected one run-owned ${kind} fixture`)
  entry.id = requireUuid((result.data[0] as any).id, `${kind} ID`)
  context.set('mutationJournal', context.get('mutationJournal'))
  return entry.id
}

export async function assertPersisted(context: Context, kind: Kind, expectedName: string) {
  const entry = (context.get('mutationJournal') as Owned[]).find(item => item.kind === kind)
  if (!entry?.names.includes(expectedName)) throw new Error('Expected value is not run-owned')
  const id = entry.id || await remember(context, kind)
  const { client, siteId } = await fixtureClient()
  const [table, field] = entities[kind]
  const result = await client.from(table).select(`id,${field}`).eq('site_id', siteId).eq('id', id).single()
  if (result.error || (result.data as any)?.[field] !== expectedName) throw new Error(`${kind} update did not persist`)
}

export async function assertRemoved(context: Context, kind: Kind) {
  const entry = (context.get('mutationJournal') as Owned[]).find(item => item.kind === kind)
  if (!entry?.id) throw new Error(`Missing saved ${kind} ID for deletion assertion`)
  const { client, siteId } = await fixtureClient()
  const [table] = entities[kind]
  const result = await client.from(table).select(kind === 'catalog' ? 'id,status' : 'id')
    .eq('site_id', siteId).eq('id', entry.id)
  if (result.error || (kind === 'catalog' ? (result.data?.[0] as any)?.status !== 'archived' : result.data?.length !== 0)) {
    throw new Error(`${kind} removal did not persist`)
  }
}

async function removeOwned(client: SupabaseClient, siteId: string, entry: Owned) {
  const [table, field] = entities[entry.kind]
  let query = client.from(table).select(`id,${field}`).eq('site_id', siteId)
  if (!entry.createdUrl) query = query.in(field, entry.names)
  if (entry.id) query = query.eq('id', entry.id)
  const found = await query
  if (found.error) throw new Error(`Unable to resolve run-owned ${entry.kind} for cleanup`)
  if (!found.data?.length) {
    if (entry.creationAttempted && !entry.id) {
      throw new Error('[E2E_BLOCKED] Record creation returned no identifiable URL or run marker; inspect the disposable site for an unrenamed record. Refusing generic cleanup.')
    }
    return
  }
  if (found.data.length !== 1) throw new Error(`Ambiguous run-owned ${entry.kind}; refusing cleanup`)
  const id = requireUuid((found.data[0] as any).id, `${entry.kind} cleanup ID`)
  // Catalog removal is archival, not physical deletion.
  const mutation = entry.kind === 'catalog'
    ? client.from(table).update({ status: 'archived' })
    : client.from(table).delete()
  let scoped = mutation.eq('site_id', siteId).eq('id', id)
  if (!entry.createdUrl) scoped = scoped.in(field, entry.names)
  const removed = await scoped.select('id')
  if (removed.error || removed.data?.length !== 1) throw new Error(`Cleanup failed for run-owned ${entry.kind}`)
  const check = await client.from(table).select(entry.kind === 'catalog' ? 'id,status' : 'id').eq('site_id', siteId).eq('id', id)
  if (check.error || (entry.kind === 'catalog' ? (check.data?.[0] as any)?.status !== 'archived' : check.data?.length !== 0)) {
    throw new Error(`Cleanup did not persist for run-owned ${entry.kind}`)
  }
}

export async function cleanup(context: Context, env: Record<string, string | undefined> = process.env) {
  const journal: Owned[] = context.get('mutationJournal') || []
  if (!journal.length) return
  const { client, siteId } = await fixtureClient(env)
  const failures: string[] = []
  // Parent registrations follow dependencies, so children are removed first.
  for (const entry of [...journal].reverse()) {
    try { await removeOwned(client, siteId, entry) } catch (error) {
      failures.push((error as Error).message)
    }
  }
  if (failures.length) throw new Error(failures.join('; '))
}