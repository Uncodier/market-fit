import { createRef } from 'react'
import { randomUUID } from 'node:crypto'
import { renderHook } from '@testing-library/react'
import { useWorkspaceTabs } from '@/app/robots/use-workspace-tabs'

const url = `/api/robots/instance/${randomUUID()}/cloud-files/${randomUUID()}?version=1&format=zip`
function input(preview = url, source: string | null = url) {
  return {
    hasRequirementPreview: true, latestPreviewUrl: preview, latestSourceCodeUrl: source,
    activeBrowserTab: { kind: 'preview' }, artifactScreens: [], t: (key: string) => key,
    pinArtifact: jest.fn(), closeArtifact: jest.fn(), setMobileWorkspaceTab: jest.fn(), setActiveBrowserTab: jest.fn(),
    mobileWorkspaceTab: 'preview', desktopToolbarRef: createRef(), desktopDeviceControlsRef: createRef(),
    desktopLayoutToggleRef: createRef(), desktopTabsPreferredWidth: 0, setDesktopTabsWidth: jest.fn(), isZipUrl: true,
  } as unknown as Parameters<typeof useWorkspaceTabs>[0]
}

it('shows only Files for a cloud-only deliverable, not repository or database tabs', () => {
  const { result } = renderHook(() => useWorkspaceTabs(input()))
  expect(result.current.allArtifactItems.map(item => item.label)).toEqual(['Files'])
  expect(result.current.workspaceTabs.map(item => item.value)).toEqual(['agent', 'preview'])
})

it('preserves application tabs when a real deployment preview exists', () => {
  const { result } = renderHook(() => useWorkspaceTabs(input('https://preview.example.test')))
  expect(result.current.allArtifactItems.map(item => item.id)).toEqual(['preview', 'source', 'database'])
})