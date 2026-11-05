import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { WorkflowPanel } from '@/app/components/workflows/workflow-panel'
import type { InstanceNode } from '@/app/types/instance-nodes'

let mockNodes: InstanceNode[] = []
const mockUpdate = jest.fn()
let mockResize: ResizeObserverCallback
const mockObserve = jest.fn()
const mockDisconnect = jest.fn()
const mockEdges = jest.fn()
const mockLoadingEdges = jest.fn()
const mockResults = { resultNodes: [], grouped: {}, loadingIds: new Set(), actionNodeIds: new Set(), loadingEdges: [] }

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site' } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/components/workflows/use-workflow-graph', () => ({ useWorkflowGraph: () => ({ nodes: mockNodes, isLoading: false, updateNode: mockUpdate }) }))
jest.mock('@/app/components/workflows/use-workflow-run-status', () => ({ useWorkflowRunStatus: () => ({ statusByNode: {} }) }))
jest.mock('@/app/components/workflows/use-workflow-result-nodes', () => ({ useWorkflowResultNodes: () => mockResults }))
jest.mock('@/app/components/agents/zoomable-canvas', () => ({ ZoomableCanvas: ({ children, extraControls, viewportStore, onSort }: { children: React.ReactNode; extraControls: React.ReactNode; viewportStore: { set: (value: object) => void }; onSort: () => void }) => <><button onClick={() => viewportStore.set({ scale: 2, position: { x: 0, y: 0 } })}>Zoom</button><button onClick={onSort}>Sort</button>{extraControls}{children}</> }))
jest.mock('@/app/components/agents/imprenta-world-svg', () => ({ ImprentaLoadingRouteEdges: (props: unknown) => { mockLoadingEdges(props); return null } }))
jest.mock('@/app/components/workflows/workflow-edges', () => ({ WorkflowEdges: (props: { heights: object; onSelectRelation: (id: string, anchor: object) => void }) => { mockEdges(props); return <button onClick={(event) => { event.stopPropagation(); props.onSelectRelation('step', { x: 10, y: 20 }) }}>Relation</button> } }))
jest.mock('@/app/components/workflows/workflow-relation-editor', () => ({ WorkflowRelationEditor: () => <div>Editor</div> }))
jest.mock('@/app/components/workflows/workflow-palette', () => ({ WorkflowPalette: () => null }))
jest.mock('@/app/components/workflows/workflow-node-card', () => ({ WorkflowNodeCard: ({ node, onMouseDown, onStartConnection }: { node: InstanceNode; onMouseDown: React.MouseEventHandler; onStartConnection: () => void }) => <div data-testid={node.id} onMouseDown={onMouseDown}>{node.id}<button onClick={(event) => { event.stopPropagation(); onStartConnection() }}>Connect {node.id}</button></div> }))
jest.mock('@/app/components/workflows/workflow-result-card', () => ({ WorkflowResultCard: () => null }))

const node = (id: string, parent: string | null = null) => ({ id, type: parent ? 'wf-step' : 'wf-trigger', parent_node_id: parent, settings: { ui_position: { x: 80, y: 80 } } }) as unknown as InstanceNode

beforeEach(() => {
  jest.clearAllMocks()
  mockNodes = [node('trigger'), node('step', 'trigger')]
  global.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) { mockResize = callback }
    observe = mockObserve
    unobserve = jest.fn()
    disconnect = mockDisconnect
  } as unknown as typeof ResizeObserver
  jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(196)
})
afterEach(() => jest.restoreAllMocks())

it('measures initially attached cards and publishes resized heights to both edge layers', () => {
  jest.useFakeTimers()
  const view = render(<React.StrictMode><WorkflowPanel activeInstanceId="one" /></React.StrictMode>)
  const target = screen.getByTestId('trigger').parentElement!
  expect(mockObserve).toHaveBeenCalledWith(target)
  Object.defineProperty(target, 'offsetHeight', { value: 420 })
  act(() => {
    mockResize([{ target } as unknown as ResizeObserverEntry], {} as ResizeObserver)
    jest.runOnlyPendingTimers()
  })
  expect(mockEdges.mock.lastCall[0].heights.trigger).toBe(420)
  expect(mockLoadingEdges.mock.lastCall[0].nodeHeights.trigger).toBe(420)
  expect(mockUpdate).not.toHaveBeenCalled()
  view.unmount()
  expect(mockDisconnect).toHaveBeenCalled()
  jest.useRealTimers()
})

it('preserves saved spacing until shorter cards are measured', () => {
  mockNodes = [node('trigger'), node('step', 'trigger')]
  mockNodes[1].settings = { ui_position: { x: 80, y: 330 } }
  jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(150)
  render(<WorkflowPanel activeInstanceId="one" />)
  expect(screen.getByTestId('step').parentElement!.style.transform).toBe('translate3d(80px, 330px, 0)')
  expect(mockUpdate).not.toHaveBeenCalled()
})

it('drags imperatively at viewport scale and persists only the final position', () => {
  const view = render(<WorkflowPanel activeInstanceId="one" />)
  fireEvent.click(screen.getByText('Zoom'))
  const card = screen.getByTestId('trigger')
  const wrapper = card.parentElement!
  fireEvent.mouseDown(card, { button: 0, clientX: 100, clientY: 100 })
  fireEvent.mouseMove(window, { clientX: 200, clientY: 160 })
  expect(wrapper.style.transform).toBe('translate3d(130px, 110px, 0)')
  expect(mockUpdate).not.toHaveBeenCalled()
  view.rerender(<WorkflowPanel activeInstanceId="one" />)
  expect(wrapper.style.transform).toBe('translate3d(130px, 110px, 0)')
  fireEvent.mouseUp(window)
  expect(mockUpdate).toHaveBeenCalledWith('trigger', { settings: { ui_position: { x: 130, y: 110 } } })
  fireEvent.mouseMove(window, { clientX: 400, clientY: 400 })
  expect(mockUpdate).toHaveBeenCalledTimes(1)
})

it('clears relation and connection UI on instance switching and when the source disappears', () => {
  const view = render(<WorkflowPanel activeInstanceId="one" />)
  fireEvent.click(screen.getByText('Relation'))
  fireEvent.click(screen.getByText('Connect trigger'))
  expect(screen.getByText('Editor')).toBeInTheDocument()
  expect(screen.getByText('Cancel connection')).toBeInTheDocument()
  view.rerender(<WorkflowPanel activeInstanceId="two" />)
  expect(screen.queryByText('Editor')).not.toBeInTheDocument()
  expect(screen.queryByText('Cancel connection')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Connect trigger'))
  mockNodes = [node('other')]
  view.rerender(<WorkflowPanel activeInstanceId="two" />)
  expect(screen.queryByText('Cancel connection')).not.toBeInTheDocument()
  expect(screen.getByTestId('other')).toBeInTheDocument()
})
