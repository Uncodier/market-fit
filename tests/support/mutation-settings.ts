import { expect, type Page, type Locator } from '@playwright/test'
import { requireMutationEnvironment } from './mutation-safety'
import { assertWorkspace, dismissConsent } from './workspace'

type Context = { get(key: string): any; set(key: string, value: any): void }
type Field = 'general' | 'company' | 'marketplace' | 'visits' | 'channels' | 'agent'
const sections: Record<Exclude<Field, 'agent'>, string> = {
  general: '#site-information', company: '#company-profile', marketplace: '#shop-hero',
  visits: '#visits-channels', channels: '#website-channel',
}

function field(page: Page, kind: Field): Locator {
  if (kind === 'agent') return page.locator('#name')
  const section = page.locator(sections[kind])
  if (kind === 'general') return section.getByPlaceholder('Describe your site...')
  if (kind === 'company') return section.locator('textarea')
  if (kind === 'marketplace') return section.getByPlaceholder('Premium quality. Exceptional design.')
  if (kind === 'visits') return section.locator('#visit-duration')
  return section.getByRole('switch', { name: 'Track Visitors', exact: true })
}

async function open(page: Page, context: Context, kind: Field) {
  requireMutationEnvironment()
  const url = kind === 'agent' ? context.get('agentUrl') : `/settings?tab=${kind}`
  if (!url) throw new Error('Missing exact agent fixture URL')
  await page.goto(url)
  await dismissConsent(page)
  await assertWorkspace(page)
  await expect(field(page, kind)).toBeVisible()
}

async function read(page: Page, kind: Field): Promise<string> {
  const input = field(page, kind)
  if (kind !== 'channels') return input.inputValue()
  const value = await input.getAttribute('aria-checked')
  if (value !== 'true' && value !== 'false') throw new Error('Invalid visitor tracking switch state')
  return value
}

async function assertValue(page: Page, kind: Field, value: string) {
  if (kind === 'channels') await expect(field(page, kind)).toHaveAttribute('aria-checked', value)
  else await expect(field(page, kind)).toHaveValue(value)
}

async function write(page: Page, kind: Field, value: string) {
  if (kind === 'channels') {
    if (await read(page, kind) !== value) await field(page, kind).click()
  } else await field(page, kind).fill(value)
}

async function save(page: Page, kind: Field) {
  const button = kind === 'agent'
    ? page.getByRole('button', { name: 'Save Basic Information', exact: true })
    : page.locator(sections[kind]).getByRole('button', { name: 'Save', exact: true })
  await expect(button).toBeEnabled()
  await button.click()
  // Save controls return from Saving... only after the persistence promise settles.
  await expect(button).toBeVisible()
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0)
  if (kind === 'agent') await expect(page.getByText('Basic information saved successfully', { exact: true })).toBeVisible()
  else await expect(button).toBeDisabled()
}

export async function updateField(page: Page, context: Context, kind: Field) {
  await open(page, context, kind)
  const original = await read(page, kind)
  context.set('settingOriginal', original)
  context.set('settingKind', kind)
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const edited = kind === 'channels' ? String(original !== 'true')
    : kind === 'visits' ? String(Number(original) === 61 ? 62 : 61)
      : kind === 'agent' ? `Shiplight Agent ${runId}` : `${original} [Shiplight ${runId}]`
  context.set('settingEdited', edited)
  await write(page, kind, edited)
  await save(page, kind)
  await page.reload()
  await assertValue(page, kind, edited)
}

export async function restoreField(page: Page, context: Context) {
  const kind = context.get('settingKind') as Field | undefined
  if (!kind) return // No original was captured and no field mutation was attempted.
  const original = context.get('settingOriginal')
  if (typeof original !== 'string') throw new Error('Missing captured original; refusing a guessed restoration')
  await open(page, context, kind)
  if (await read(page, kind) !== original) {
    await write(page, kind, original)
    await save(page, kind)
  }
  await page.reload()
  await assertValue(page, kind, original)
}