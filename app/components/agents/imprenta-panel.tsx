"use client"

import { useImprentaPanelState } from "./imprenta-panel/state"
import { useImprentaMeasurement } from "./imprenta-panel/measurement"
import { useImprentaVirtualization } from "./imprenta-panel/virtualization"
import { useImprentaSynchronization } from "./imprenta-panel/sync"
import { useImprentaExecution } from "./imprenta-panel/execution"
import { useImprentaNodeActions } from "./imprenta-panel/node-actions"
import { useImprentaDragging } from "./imprenta-panel/drag"
import { useImprentaConnections } from "./imprenta-panel/connections"
import { useImprentaMedia } from "./imprenta-panel/media"
import { useImprentaLayout } from "./imprenta-panel/graph-layout"
import { useImprentaLayoutEffects } from "./imprenta-panel/layout-effects"
import { ImprentaPanelView } from "./imprenta-panel/view"

export function ImprentaPanel({ activeInstanceId }: { activeInstanceId?: string }) {
  const scope = { activeInstanceId }
  const state = useImprentaPanelState(scope)
  const layout = useImprentaLayout(state)
  const measurement = useImprentaMeasurement({ ...state, ...layout })
  const virtualization = useImprentaVirtualization({ ...state, ...measurement })

  useImprentaSynchronization({ ...scope, ...state })

  const execution = useImprentaExecution({ ...state, ...measurement })
  const nodeActions = useImprentaNodeActions({ ...scope, ...state })
  const dragging = useImprentaDragging(state)
  const connections = useImprentaConnections({ ...state, ...layout })
  const media = useImprentaMedia(state)
  const layoutEffects = useImprentaLayoutEffects({
    ...state,
    ...layout,
    ...dragging,
    ...nodeActions,
    ...connections,
    ...execution,
    ...virtualization,
  })

  return (
    <ImprentaPanelView
      {...scope}
      {...state}
      {...layout}
      {...measurement}
      {...virtualization}
      {...execution}
      {...nodeActions}
      {...dragging}
      {...connections}
      {...media}
      {...layoutEffects}
    />
  )
}
