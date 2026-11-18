import { fireEvent, render, screen } from '@testing-library/react'
import { ImprentaContextControls } from '@/app/components/agents/imprenta-panel/context-controls'
import type { InstanceNode } from '@/app/types/instance-nodes'

jest.mock('@/app/components/ui/screen-anchored-panel', () => ({ ScreenAnchoredPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock('@/app/components/agents/imprenta-context-type-select', () => ({ ImprentaContextTypeSelect: () => <span>Relation type</span> }))

it('opens a crossing relation editor even with both endpoints outside the viewport', () => {
  const onDelete = jest.fn()
  const props = {
    contexts: [{ id: 'edge', context_node_id: 'a', target_node_id: 'b', type: 'reference' }],
    positions: { a: { x: -10000, y: 0 }, b: { x: 10000, y: 0 } }, nodeHeights: {},
    nodesById: new Map([['b', { id: 'b', type: 'prompt', result: {} } as InstanceNode]]),
    visibleNodeIds: new Set<string>(), showLabels: false, selectedId: 'edge', anchor: { x: 300, y: 200 },
    nodeW: 480, rowH: 300, onSelect: jest.fn(), onChange: jest.fn(), onDelete,
  }
  const view = render(<ImprentaContextControls {...props} />)
  expect(screen.getByText('Relation type')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Delete connection' }))
  expect(onDelete).toHaveBeenCalledWith('edge')
  view.rerender(<ImprentaContextControls {...props} nodesById={new Map([['b', { ...props.nodesById.get('b')!, result: { text: 'Completed' } }]])} />)
  expect(screen.queryByRole('button', { name: 'Delete connection' })).not.toBeInTheDocument()
})