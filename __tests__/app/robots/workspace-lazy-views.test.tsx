import { act, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { RobotsWorkspace } from '@/app/robots/robots-workspace'

const mockLoad = jest.fn()
jest.mock('@/app/components/simple-messages-view', () => {
  mockLoad('messages')
  return { SimpleMessagesView: ({ activeRobotInstance }: { activeRobotInstance: { id: string } }) => <div>Messages {activeRobotInstance.id}</div> }
})
jest.mock('@/app/components/workflows/workflow-panel', () => {
  mockLoad('workflow')
  return { WorkflowPanel: ({ activeInstanceId }: { activeInstanceId: string }) => <div>Workflow {activeInstanceId}</div> }
})
jest.mock('@/app/components/agents/imprenta-panel', () => {
  mockLoad('canvas')
  return { ImprentaPanel: ({ activeInstanceId }: { activeInstanceId: string }) => <div>Canvas {activeInstanceId}</div> }
})
jest.mock('@/app/components/skeletons/messages-skeleton', () => ({ MessagesSkeleton: () => <div>Loading messages</div> }))
jest.mock('@/app/components/skeletons/workflow-skeleton', () => ({ WorkflowSkeleton: () => <div>Loading workflow</div> }))
jest.mock('@/app/components/ui/responsive-tabs-list', () => ({ ResponsiveTabsList: () => null }))
jest.mock('@/app/robots/screen-metadata', () => ({ getScreenMetadata: jest.fn() }))
jest.mock('@/app/robots/requirement-runner-card', () => ({ RequirementRunnerCard: () => null }))

function props(viewMode: 'imprenta' | 'workflow' | 'agent', instanceId = 'a') {
  return {
    viewMode, isCanvasMode: viewMode !== 'agent', workspaceTabs: [], hasBrowserContent: false,
    activeRobotInstance: { id: instanceId }, currentSite: { id: 'site' }, siteChangeKey: 0,
    isMobile: false, searchParams: new URLSearchParams(),
  } as unknown as ComponentProps<typeof RobotsWorkspace>
}

it('loads only the selected panel, renders skeletons, and switches mutually exclusive views with current props', async () => {
  expect(mockLoad).not.toHaveBeenCalled()
  const view = render(<RobotsWorkspace {...props('imprenta')} />)
  await screen.findByText('Canvas a')
  expect(mockLoad.mock.calls).toEqual([['canvas']])

  view.rerender(<RobotsWorkspace {...props('workflow', 'b')} />)
  expect(screen.getByText('Loading workflow')).toBeInTheDocument()
  expect(screen.queryByText('Canvas a')).not.toBeInTheDocument()
  await screen.findByText('Workflow b')
  expect(mockLoad.mock.calls).toEqual([['canvas'], ['workflow']])

  view.rerender(<RobotsWorkspace {...props('agent', 'c')} />)
  expect(screen.getByText('Loading messages')).toBeInTheDocument()
  expect(screen.queryByText('Workflow b')).not.toBeInTheDocument()
  await screen.findByText('Messages c')
  expect(mockLoad.mock.calls).toEqual([['canvas'], ['workflow'], ['messages']])

  await act(async () => view.rerender(<RobotsWorkspace {...props('workflow', 'd')} />))
  expect(screen.getByText('Workflow d')).toBeInTheDocument()
  expect(screen.queryByText('Messages c')).not.toBeInTheDocument()
  expect(mockLoad).toHaveBeenCalledTimes(3)
})