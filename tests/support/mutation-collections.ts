import { expect, type Page } from '@playwright/test'
import { requireMutationEnvironment } from './mutation-safety'
import { assertWorkspace, dismissConsent } from './workspace'
import { fixtureClient } from './mutation-fixtures'

type Kind = 'asset' | 'calendar' | 'printer' | 'secret' | 'team'
type Context = { get(key: string): any; set(key: string, value: any): void }
const routes: Record<Kind, string> = {
  asset: '/assets', calendar: '/settings?tab=calendar', printer: '/settings?tab=printers',
  secret: '/settings?tab=secrets', team: '/settings?tab=team',
}
const readyButtons: Record<Kind, string> = {
  asset: 'New asset', calendar: 'Add Calendar', printer: 'Add printer',
  secret: 'Add Secret', team: 'Invite New Member to Team',
}

async function storedEntries(kind: Kind) {
  const { client, siteId } = await fixtureClient()
  if (kind === 'calendar' || kind === 'printer') {
    const column = kind === 'calendar' ? 'calendars' : 'printers'
    const result = await client.from('settings').select(column).eq('site_id', siteId).single()
    if (result.error || !result.data) throw new Error(`Unable to load persisted ${kind} settings`)
    const data = result.data as unknown as Record<string, any>
    const entries = kind === 'calendar' ? data.calendars : data.printers?.devices
    if (entries != null && !Array.isArray(entries)) throw new Error(`Invalid persisted ${kind} collection`)
    return (entries || []) as { id: string; name: string; email?: string }[]
  }
  const table = { asset: 'assets', secret: 'site_secrets', team: 'site_members' }[kind]
  const result = await client.from(table).select(kind === 'team' ? 'id,email' : 'id,name').eq('site_id', siteId)
  if (result.error || !result.data) throw new Error(`Unable to load persisted ${kind} collection`)
  return result.data as unknown as { id: string; name: string; email?: string }[]
}

export async function prepareCollection(page: Page, context: Context, kind: Kind) {
  await openCollection(page, kind)
  const entries = await storedEntries(kind)
  if (kind === 'printer' && entries.length) {
    throw new Error('Printer CRUD requires a disposable workspace with no printers; existing printer settings will not be overwritten')
  }
  context.set('collectionOriginalIds', entries.map(entry => entry.id).sort())
}

export async function openCollection(page: Page, kind: Kind) {
  requireMutationEnvironment()
  await page.goto(routes[kind])
  await dismissConsent(page)
  await assertWorkspace(page)
  await expect(page.getByRole('button', { name: readyButtons[kind], exact: true }).first()).toBeVisible()
  await expect(page.locator('.animate-pulse:visible')).toHaveCount(0)
  if (kind === 'secret') await expect(page.getByText('Loading...', { exact: true })).toHaveCount(0)
}

function marker(page: Page, kind: Kind, name: string) {
  return kind === 'team'
    ? page.locator(`[id^="team-member-"] input[value=${JSON.stringify(name)}]`)
    : page.getByText(name, { exact: true })
}

export async function rememberCollection(page: Page, context: Context, kind: Kind) {
  const name = context.get('collectionName')
  if (!name) throw new Error('Missing run-owned collection name')
  await expect(marker(page, kind, name)).toHaveCount(1)
  await expect(marker(page, kind, name)).toBeVisible()
  const matches = (await storedEntries(kind)).filter(entry => (kind === 'team' ? entry.email : entry.name) === name)
  if (matches.length !== 1) throw new Error(`Expected one persisted run-owned ${kind}`)
  context.set('collectionStoredId', matches[0].id)
  if (kind === 'asset' || kind === 'secret') {
    const { client, siteId } = await fixtureClient()
    const result = await client.from(kind === 'asset' ? 'assets' : 'site_secrets').select('id')
      .eq('site_id', siteId).eq('name', name).single()
    if (result.error || !result.data) throw new Error(`Run-owned ${kind} ID could not be resolved`)
    context.set('collectionId', result.data.id)
  } else if (kind === 'printer') {
    const card = page.locator('[id^="printer-"]').filter({ has: marker(page, kind, name) })
    await expect(card).toHaveCount(1)
    context.set('collectionId', await card.getAttribute('id'))
  } else if (kind === 'team') {
    const card = page.locator('[id^="team-member-"]').filter({ has: marker(page, kind, name) })
    await expect(card).toHaveCount(1)
    context.set('collectionId', await card.getAttribute('id'))
  } else if (kind === 'calendar') {
    await marker(page, kind, name).click()
    const input = page.locator('input[id^="rr-name-"]').filter({ visible: true })
    await expect(input).toHaveValue(name)
    context.set('collectionId', (await input.getAttribute('id'))?.replace('rr-name-', ''))
  }
  context.set('collectionUrl', page.url())
}

export async function removeCollection(page: Page, context: Context, kind: Kind, required = false) {
  const name = context.get('collectionName')
  const original = context.get('collectionOriginalIds')
  if (!name || !original) return // Setup failed before any entity could be created.
  await openCollection(page, kind)
  const item = marker(page, kind, name)
  const persisted = (await storedEntries(kind)).filter(entry => (kind === 'team' ? entry.email : entry.name) === name)
  if (persisted.length > 1) throw new Error(`Ambiguous run-owned ${kind}; refusing cleanup`)
  const count = await item.count()
  if (!count) {
    if (persisted.length) throw new Error(`Persisted ${kind} is unavailable in the UI; cleanup required`)
    if (required) throw new Error(`Created ${kind} is missing before the delete assertion`)
    expect((await storedEntries(kind)).map(entry => entry.id).sort()).toEqual(original)
    return
  }
  await expect(item).toHaveCount(1)
  if (kind === 'asset') {
    await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete Asset', exact: true }).click()
  } else if (kind === 'secret') {
    const row = page.getByRole('row').filter({ has: item })
    await expect(row).toHaveCount(1)
    // SecretsSection renders visibility then delete, with no accessible label.
    await expect(row.getByRole('button')).toHaveCount(2)
    await row.getByRole('button').nth(1).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
  } else if (kind === 'calendar') {
    await item.click()
    const input = page.locator('input[id^="rr-name-"]').filter({ visible: true })
    await expect(input).toHaveValue(name)
    if (context.get('collectionId')) await expect(input).toHaveAttribute('id', `rr-name-${context.get('collectionId')}`)
    await page.getByRole('button', { name: 'Remove Calendar', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
  } else {
    const prefix = kind === 'team' ? 'team-member-' : 'printer-'
    const card = page.locator(`[id^="${prefix}"]`).filter({ has: item })
    await expect(card).toHaveCount(1)
    if (context.get('collectionId')) await expect(card).toHaveAttribute('id', context.get('collectionId'))
    if (kind === 'team') {
      await card.getByRole('button', { name: 'Remove', exact: true }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Remove', exact: true }).click()
    } else {
      await item.click()
      await card.getByRole('button', { name: 'Remove printer', exact: true }).click()
      await page.getByRole('button', { name: 'Save', exact: true }).last().click()
      await expect(page.getByText('Printer settings saved', { exact: true })).toBeVisible()
    }
  }
  await expect(item).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: readyButtons[kind], exact: true }).first()).toBeVisible()
  await expect(page.locator('.animate-pulse:visible')).toHaveCount(0)
  if (kind === 'secret') await expect(page.getByText('Loading...', { exact: true })).toHaveCount(0)
  await expect(item).toHaveCount(0)
  const remaining = await storedEntries(kind)
  if (remaining.some(entry => (kind === 'team' ? entry.email : entry.name) === name)) throw new Error(`${kind} deletion did not persist`)
  expect(remaining.map(entry => entry.id).sort()).toEqual(original)
}