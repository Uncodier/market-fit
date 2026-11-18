import { Trash2 } from '@/app/components/ui/icons'
import { Button } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'
import { ScreenAnchoredPanel } from '@/app/components/ui/screen-anchored-panel'
import { ImprentaContextTypeSelect } from '../imprenta-context-type-select'
import { getPublishContextAnchorY, getPublishContextEdgeCaption } from '../imprenta-publish-context'
import { imprentaNodeHasResult } from './result-helpers'
import type { InstanceNode } from '@/app/types/instance-nodes'
import type { ImprentaContext } from './data-types'

export function ImprentaContextControls({ contexts, positions, nodeHeights, nodesById,
  visibleNodeIds, showLabels, selectedId, anchor, onSelect, onChange, onDelete, nodeW, rowH,
}: {
  contexts: ImprentaContext[]
  positions: Record<string, { x: number; y: number }>
  nodeHeights: Record<string, number>
  nodesById: Map<string, InstanceNode>
  visibleNodeIds: Set<string> | null
  showLabels: boolean
  selectedId: string | null
  anchor: { x: number; y: number } | null
  onSelect: (id: string, anchor: { x: number; y: number }) => void
  onChange: (id: string, value: string) => void
  onDelete: (id: string) => void
  nodeW: number
  rowH: number
}) {
  return <>{contexts.filter(context => context.id === selectedId || (showLabels && (
    !visibleNodeIds || visibleNodeIds.has(context.context_node_id) || visibleNodeIds.has(context.target_node_id)
  ))).map(context => {
    const start = positions[context.context_node_id], end = positions[context.target_node_id]
    if (!start || !end) return null
    const target = nodesById.get(context.target_node_id)
    const selected = context.id === selectedId
    const locked = !!target && imprentaNodeHasResult(target)
    const y1 = start.y + (nodeHeights[context.context_node_id] || rowH) / 2
    const y2 = end.y + getPublishContextAnchorY(target?.type, context.type, nodeHeights[context.target_node_id] || rowH)
    return <div key={context.id} data-imprenta-context-control className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: selected ? 30 : 0 }}>
      {showLabels && !selected && (context.type != null || target?.type === 'publish') && <button type="button"
        className="absolute px-2 py-0.5 bg-background border border-primary/20 text-primary text-[10px] font-medium rounded-full shadow-sm pointer-events-auto cursor-pointer whitespace-nowrap"
        style={{ left: (start.x + nodeW + end.x) / 2, top: (y1 + y2) / 2, transform: 'translate(-50%, -50%)' }}
        onClick={event => { event.stopPropagation(); onSelect(context.id, { x: event.clientX, y: event.clientY }) }}>
        {getPublishContextEdgeCaption(target?.type, context.type)}
      </button>}
      {selected && anchor && <ScreenAnchoredPanel anchor={anchor}>
        <Card className="pointer-events-auto z-50 flex items-center gap-1 border-primary/30 p-1 shadow-xl" onClick={event => event.stopPropagation()}>
          <ImprentaContextTypeSelect value={context.type || 'reference'} onValueChange={value => onChange(context.id, value)} />
          {!locked && <><div className="mx-1 h-4 w-px bg-border" /><Button variant="ghost" size="icon" aria-label="Delete connection"
            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(context.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button></>}
        </Card>
      </ScreenAnchoredPanel>}
    </div>
  })}</>
}