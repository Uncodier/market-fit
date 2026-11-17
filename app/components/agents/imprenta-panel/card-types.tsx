import type { InstanceNode } from "@/app/types/instance-nodes"
import type { useImprentaPanelState } from "./state"
import type { useImprentaLayoutEffects } from "./layout-effects"
import type { useImprentaMedia } from "./media"

type State = ReturnType<typeof useImprentaPanelState>

export type ImprentaNodeCardProps = Pick<State,
  "nodes" | "contexts" | "logs" | "supabase" |
  "currentSite" | "textParams" | "imageParams" |
  "videoParams" | "audioParams"
> & {
  node: InstanceNode
  pos: { x: number; y: number }
  isDragging: boolean
  isGenerating: boolean
  hasRealChildren: boolean
  hasResult: boolean
  actionRunning: boolean
  hasCnt: boolean
  hasAud: boolean
  needAudience: boolean
  registerNodeRef: (id: string, el: HTMLDivElement | null) => void
  renderMediaWithZoom: ReturnType<typeof useImprentaMedia>["renderMediaWithZoom"]
  actions: ReturnType<typeof useImprentaLayoutEffects>["actions"]
}
