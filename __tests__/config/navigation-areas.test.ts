import {
  NAVIGATION_MENU_AREA_ORDER,
  NAVIGATION_AREAS,
  buildNavItemHref,
  findNavigationMenuItem,
  getNavigationMenuItems,
  getNavItemTitle,
  isConfigurationNavPath,
  isSettingsNavKey,
} from '@/app/config/navigation-areas'
import { NAV_ITEM_ICON, getModuleVisual } from '@/app/config/module-visuals'
import { ClipboardList, Home } from '@/app/components/ui/icons'

describe('navigation-areas', () => {
  it('exposes operational procurement modules in Buying', () => {
    for (const [key, path, title] of [
      ['suppliers', '/suppliers', 'Suppliers'],
      ['purchaseRequests', '/purchases/requests', 'Purchase Requests'],
      ['procurementTenders', '/purchases/tenders', 'Tenders'],
    ]) {
      const entry = findNavigationMenuItem(key)!
      expect(entry.area).toBe('buying')
      expect(buildNavItemHref(entry.item)).toBe(path)
      expect(getNavItemTitle(entry.item, value => value)).toBe(title)
      expect(NAV_ITEM_ICON[key]).toBeDefined()
    }
  })
  it('separates procurement settings from Buying rules with readable titles', () => {
    const rules = findNavigationMenuItem('procurementRules')!
    const settings = findNavigationMenuItem('procurementSettings')!
    expect(rules.area).toBe('buying')
    expect(settings.area).toBe('settings')
    expect(buildNavItemHref(rules.item)).toBe('/purchases/rules')
    expect(buildNavItemHref(settings.item)).toBe('/settings/procurement')
    expect(getNavItemTitle(rules.item, key => key)).toBe('Procurement Rules')
    expect(getNavItemTitle(settings.item, key => key)).toBe('Procurement')
    expect(isSettingsNavKey('procurementSettings')).toBe(true)
    expect(isConfigurationNavPath('/settings/procurement')).toBe(true)
    expect(NAV_ITEM_ICON.procurementRules).toBe(ClipboardList)
  })
  it('includes Settings in the apps launcher but not as sidebar shortcuts', () => {
    expect(NAVIGATION_MENU_AREA_ORDER).toContain('settings')
  })

  it('shows Procurement immediately after General in Settings', () => {
    expect(getNavigationMenuItems('settings').slice(0, 3).map(item => item.key))
      .toEqual(['settingsGeneral', 'procurementSettings', 'company'])
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
    expect(isConfigurationNavPath('/onboarding')).toBe(true)
    expect(isConfigurationNavPath('/navigation')).toBe(true)
  })

  it('still allows printer and automation settings tabs as shortcuts', () => {
    expect(isConfigurationNavPath('/settings', new URLSearchParams('tab=printers'))).toBe(false)
    expect(isConfigurationNavPath('/settings', new URLSearchParams('tab=channels'))).toBe(false)
    expect(isConfigurationNavPath('/settings', new URLSearchParams('tab=activities'))).toBe(false)
    expect(isConfigurationNavPath('/leads')).toBe(false)
  })

  it('includes order lines in Operations', () => {
    expect(NAVIGATION_AREAS.operations.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'orderLines', href: '/order-lines' }),
      ])
    )
    expect(NAV_ITEM_ICON.orderLines).toBe(ClipboardList)
  })

  it('shows AI Workspace first in Automation only in the apps launcher', () => {
    const automationItems = getNavigationMenuItems('automation')

    expect(automationItems[0]).toEqual(
      expect.objectContaining({ key: 'aiWorkspace', href: '/robots' })
    )
    expect(buildNavItemHref(automationItems[0])).toBe('/robots')
    expect(NAV_ITEM_ICON.aiWorkspace).toBe(Home)
    expect(getModuleVisual('automation', 'aiWorkspace')).toEqual(
      getModuleVisual('automation', 'salesHome'),
    )
    expect(automationItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'agentsConfiguration', href: '/agents' }),
      ])
    )
    expect(automationItems).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'salesHome' })])
    )
    expect(getNavigationMenuItems('sales')).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'salesHome' })])
    )
    expect(NAVIGATION_AREAS.automation.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'aiWorkspace' })])
    )
    expect(NAVIGATION_AREAS.sales.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'salesHome', hidden: true }),
      ])
    )
  })

  it('iterates AI Workspace exactly once under Automation for launcher consumers', () => {
    const launcherEntries = NAVIGATION_MENU_AREA_ORDER.flatMap((area) =>
      getNavigationMenuItems(area).map((item) => ({ area, item })),
    )

    expect(
      launcherEntries.filter(({ item }) => item.key === 'aiWorkspace'),
    ).toEqual([
      expect.objectContaining({
        area: 'automation',
        item: expect.objectContaining({ key: 'aiWorkspace' }),
      }),
    ])
    expect(findNavigationMenuItem('aiWorkspace')).toEqual(
      expect.objectContaining({
        area: 'automation',
        item: expect.objectContaining({ key: 'aiWorkspace' }),
      }),
    )
    expect(findNavigationMenuItem('salesHome')).toBeUndefined()
  })

  it('uses the sidebar title for AI Workspace with a readable fallback', () => {
    const workspaceItem = getNavigationMenuItems('automation')[0]

    expect(getNavItemTitle(workspaceItem, (key) => key)).toBe('AI Workspace')
    expect(getNavItemTitle(workspaceItem, (key) =>
      key === 'layout.sidebar.agents' ? 'Workspace' : key,
    )).toBe('Workspace')
  })
})
