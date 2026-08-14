import {
  NAVIGATION_MENU_AREA_ORDER,
  isConfigurationNavPath,
  isSettingsNavKey,
} from '@/app/config/navigation-areas'

describe('navigation-areas', () => {
  it('includes Settings in the apps launcher but not as sidebar shortcuts', () => {
    expect(NAVIGATION_MENU_AREA_ORDER).toContain('settings')
  })

  it('treats Configuration screens as settings nav keys', () => {
    expect(isSettingsNavKey('settingsGeneral')).toBe(true)
    expect(isSettingsNavKey('billing')).toBe(true)
    expect(isSettingsNavKey('leads')).toBe(false)
  })

  it('does not pin Configuration paths as sidebar shortcuts', () => {
    expect(isConfigurationNavPath('/settings')).toBe(true)
    expect(isConfigurationNavPath('/settings', new URLSearchParams('tab=general'))).toBe(true)
    expect(isConfigurationNavPath('/settings', new URLSearchParams('tab=team'))).toBe(true)
    expect(isConfigurationNavPath('/integrations')).toBe(true)
    expect(isConfigurationNavPath('/billing')).toBe(true)
    expect(isConfigurationNavPath('/security')).toBe(true)
  })

  it('still allows printer and automation settings tabs as shortcuts', () => {
    expect(isConfigurationNavPath('/settings', new URLSearchParams('tab=printers'))).toBe(false)
    expect(isConfigurationNavPath('/settings', new URLSearchParams('tab=channels'))).toBe(false)
    expect(isConfigurationNavPath('/settings', new URLSearchParams('tab=activities'))).toBe(false)
    expect(isConfigurationNavPath('/leads')).toBe(false)
  })
})
