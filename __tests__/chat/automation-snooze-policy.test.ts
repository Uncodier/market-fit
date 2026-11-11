import { activitiesSchema, mergeActivitySettings, normalizeActivitySettings } from '@/app/components/settings/activity-settings'
import { leadAutomationSnoozeHoursSchema, resolveAutomationSnoozeHours, siteAutomationSnoozeSchema } from '@/lib/chat/automation-snooze-policy'

it('is on by default for missing/general settings', () => {
  expect(normalizeActivitySettings().conversation_automation_snooze).toEqual({ status: 'default', hours: 4 })
  expect(activitiesSchema.parse({}).conversation_automation_snooze).toEqual({ status: 'default', hours: 4 })
  expect(resolveAutomationSnoozeHours(null, siteAutomationSnoozeSchema.parse(undefined))).toBe(4)
})

it('resolves lead override before site and supports inactive site inheritance', () => {
  const site = { status: 'inactive' as const, hours: 8 }
  expect(resolveAutomationSnoozeHours(null, site)).toBe(0)
  expect(resolveAutomationSnoozeHours(2.5, site)).toBe(2.5)
  expect(resolveAutomationSnoozeHours(0, { status: 'default', hours: 4 })).toBe(0)
  expect(resolveAutomationSnoozeHours(null, { status: 'default', hours: 8 })).toBe(8)
})

it('preserves hours/extensions/neighbors on partial activity save', () => {
  const merged = mergeActivitySettings({ conversation_automation_snooze: { status: 'default', hours: 8, extension: true }, email_sync: { status: 'inactive' } }, { conversation_automation_snooze: { status: 'inactive' } })
  expect(merged.conversation_automation_snooze).toEqual({ status: 'inactive', hours: 8, extension: true })
  expect(merged.email_sync.status).toBe('inactive')
})

it.each([0, -1, 169, Infinity, NaN, '4', null])('rejects invalid global hours %s including after normalization', hours => {
  expect(siteAutomationSnoozeSchema.safeParse({ hours }).success).toBe(false)
  expect(activitiesSchema.safeParse(normalizeActivitySettings({ conversation_automation_snooze: { hours } })).success).toBe(false)
})

it.each([null, 0, 0.5, 168])('accepts lead override %s', hours => {
  expect(leadAutomationSnoozeHoursSchema.safeParse(hours).success).toBe(true)
})