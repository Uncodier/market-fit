import { procurementValueLabel } from '@/app/purchases/procurement/i18n/messages'

describe('custom procurement values', () => {
  test.each(['en', 'es', 'fr', 'de', 'ja'] as const)('preserves user-authored identifiers in %s', locale => {
    for (const value of ['custom_business_type', 'ISO_27001:2022', 'User-authored TYPE', '']) {
      expect(procurementValueLabel(value, locale)).toBe(value)
    }
  })
})