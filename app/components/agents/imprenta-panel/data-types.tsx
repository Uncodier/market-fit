import type { InstanceNode } from "@/app/types/instance-nodes"

/** Database context row fields used by graph connections and publish validation. */
export type ImprentaContext = InstanceNode["settings"] & {
  id: string
  target_node_id: string
  context_node_id: string
  type?: string | null
}

/** Logs keep their existing dynamic tool payload while exposing its typed owner. */
export type ImprentaLog = InstanceNode["result"]
