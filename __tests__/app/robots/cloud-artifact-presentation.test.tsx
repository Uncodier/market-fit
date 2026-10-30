import { createRef } from 'react'
import { randomUUID } from 'node:crypto'
import { renderHook } from '@testing-library/react'
import { useBrowserPresentation } from '@/app/robots/use-browser-presentation'

jest.mock('@/app/robots/use-tenant-lookup', () => ({ useTenantLookup: () => ({ url: null }) }))
jest.mock('@/app/hooks/use-iframe-url', () => ({ useIframeUrl: (_ref: unknown, url: string) => ({ displayUrl: url, iframeSrc: url }) }))
jest.mock('@/app/robots/delete-instance-artifacts', () => ({ deleteInstanceArtifacts: jest.fn() }))
jest.mock('@/app/robots/artifact-navigation-shortcut', () => ({ pinArtifactToNavigation: jest.fn() }))

it('preserves an existing source_code artifact revision URL without iframe query decoration', () => {
  const url = `/api/robots/instance/${randomUUID()}/cloud-files/${randomUUID()}?version=2&format=zip`
  const input = {
    requirementStatuses: [], artifacts: [{ screen: 'source_code', url }],
    activeRobotInstance: { id: randomUUID(), site_id: randomUUID() },
    currentSite: { id: randomUUID() }, activeBrowserTab: { kind: 'artifact', screen: 'source_code' },
    setActiveBrowserTab: jest.fn(), setMobileWorkspaceTab: jest.fn(), workspaceLayout: 'split',
    mobileWorkspaceTab: 'preview', theme: 'dark', viewportSize: 'imac',
    iframeRef: createRef<HTMLIFrameElement>(), containerRef: createRef<HTMLDivElement>(), setScale: jest.fn(),
  } as unknown as Parameters<typeof useBrowserPresentation>[0]
  const { result } = renderHook(() => useBrowserPresentation(input))
  expect(result.current.activeUrlToDisplay).toBe(url)
  expect(result.current.isZipUrl).toBe(true)
})