import { act, renderHook } from '@testing-library/react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useNavigationHistory } from '@/app/hooks/use-breadcrumb-history'
import { NAVIGATION_AREAS } from '@/app/config/navigation-areas'
import { workspaceScreenTitle } from '@/lib/navigation/workspace-screen'

function setRoute(path: string) {
  jest.mocked(usePathname).mockReturnValue(path)
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  Object.defineProperty(performance, 'getEntriesByType', {
    configurable: true, value: jest.fn(() => []),
  })
})

test('the real hook repairs persisted Purchases history and resets every sidebar destination', () => {
  setRoute('/purchases/procurement/approvals')
  localStorage.setItem('navigationHistory', JSON.stringify({ items: [
    { path: '/purchases', label: 'Compras', timestamp: 1 },
    { path: '/purchases/procurement/approvals', label: 'Approvals', timestamp: 2 },
  ] }))
  const hook = renderHook(() => useNavigationHistory())
  expect(hook.result.current.items).toHaveLength(1)
  expect(hook.result.current.items[0].path).toBe('/purchases/procurement/approvals')

  const paths = [...new Set(Object.values(NAVIGATION_AREAS).flatMap(area => area.items.map(item => item.href)))]
  for (const path of paths) {
    sessionStorage.setItem('uiNavTimestamp', String(Date.now()))
    setRoute(path)
    hook.rerender()
    expect(hook.result.current.items).toHaveLength(1)
    expect(hook.result.current.items[0].path).toBe(path)
    const label = workspaceScreenTitle(path)
    if (label) expect(hook.result.current.items[0].label).toBe(label)
    expect(JSON.parse(localStorage.getItem('navigationHistory')!).items).toEqual(hook.result.current.items)
  }
})

test('title updates and detail navigation retain a real request parent', () => {
  setRoute('/purchases/requests')
  const hook = renderHook(() => useNavigationHistory())
  setRoute('/purchases/requests/id')
  sessionStorage.setItem('uiNavTimestamp', String(Date.now()))
  hook.rerender()
  act(() => window.dispatchEvent(new CustomEvent('breadcrumb:update', {
    detail: { title: 'Office supplies', path: '/purchases/requests/id' },
  })))
  expect(hook.result.current.items.map(item => item.path)).toEqual([
    '/purchases/requests', '/purchases/requests/id',
  ])
  expect(hook.result.current.items[1].label).toBe('Office supplies')
})