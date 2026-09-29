/** @jest-environment node */
import { restoreField, updateField } from '../../tests/support/mutation-settings'

let visibleValue = ''
let persistedValue = ''
let failReloadAssertion = false
let failSave = false
let saves = 0
let reloads = 0
let snapshotAtFirstWrite: unknown
const values = new Map<string, any>()
const context = { get: (key: string) => values.get(key), set: (key: string, value: any) => values.set(key, value) }

jest.mock('../../tests/support/mutation-safety', () => ({ requireMutationEnvironment: jest.fn() }))
jest.mock('../../tests/support/workspace', () => ({ assertWorkspace: jest.fn(), dismissConsent: jest.fn() }))
jest.mock('@playwright/test', () => ({
  expect: (value: any) => ({
    toBeVisible: async () => {}, toBeEnabled: async () => {}, toBeDisabled: async () => {},
    toHaveCount: async () => {},
    toHaveValue: async (expected: string) => {
      if (failReloadAssertion) { failReloadAssertion = false; throw new Error('Simulated post-save failure') }
      if (visibleValue !== expected) throw new Error('Persisted value mismatch')
    },
    toHaveAttribute: async (_name: string, expected: string) => {
      if (visibleValue !== expected) throw new Error('Persisted toggle mismatch')
    },
  }),
}))

const control: any = {
  locator: () => control, getByPlaceholder: () => control, getByRole: () => control,
  inputValue: async () => visibleValue,
  getAttribute: async () => visibleValue,
  fill: async (value: string) => {
    if (snapshotAtFirstWrite === undefined) snapshotAtFirstWrite = values.get('settingOriginal')
    visibleValue = value
  },
  click: async () => { visibleValue = String(visibleValue !== 'true') },
}
const save: any = {
  click: async () => {
    saves++
    if (failSave) { failSave = false; throw new Error('Save unavailable') }
    persistedValue = visibleValue
  },
}
const section: any = {
  locator: () => control, getByPlaceholder: () => control,
  getByRole: (role: string) => role === 'button' ? save : control,
}
const page: any = {
  goto: async () => { visibleValue = persistedValue },
  reload: async () => { reloads++; visibleValue = persistedValue },
  locator: (selector: string) => selector === '#name' ? control : section,
  getByRole: () => save, getByText: () => control,
}

beforeEach(() => {
  values.clear(); visibleValue = ''; persistedValue = ''; failSave = false
  failReloadAssertion = false; saves = 0; reloads = 0; snapshotAtFirstWrite = undefined
})

it('captures a real empty original before mutation and restores it without a default value', async () => {
  await updateField(page, context, 'general')
  expect(snapshotAtFirstWrite).toBe('')
  expect(persistedValue).toMatch(/Shiplight/)
  await restoreField(page, context)
  expect(persistedValue).toBe('')
  expect(reloads).toBe(2)
  expect(saves).toBe(2)
})

it('restores after an assertion fails after a successful save', async () => {
  persistedValue = 'Original company profile'
  failReloadAssertion = true
  await expect(updateField(page, context, 'company')).rejects.toThrow(/post-save failure/)
  expect(persistedValue).not.toBe('Original company profile')
  await restoreField(page, context)
  expect(persistedValue).toBe('Original company profile')
})

it('does not write a guessed fallback when capture did not happen', async () => {
  await restoreField(page, context)
  expect(saves).toBe(0)
  context.set('settingKind', 'visits')
  await expect(restoreField(page, context)).rejects.toThrow(/Missing captured original/)
  expect(saves).toBe(0)
})

it('handles save failure without overwriting the already-original persisted state', async () => {
  persistedValue = 'Existing description'; failSave = true
  await expect(updateField(page, context, 'general')).rejects.toThrow(/Save unavailable/)
  await restoreField(page, context)
  expect(persistedValue).toBe('Existing description')
  expect(saves).toBe(1)
  expect(reloads).toBe(1)
})

it('updates and restores the exact existing agent URL, not the first agent', async () => {
  persistedValue = 'Original agent'; context.set('agentUrl', '/agents/explicit-id')
  await updateField(page, context, 'agent')
  await restoreField(page, context)
  expect(persistedValue).toBe('Original agent')
  expect(reloads).toBe(2)
})