"use server"

import { createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { processRecordEmbeddingsById } from "../lib/record-embedding-worker"
import {
  buildNodeEmbeddingText,
  emptyRecordDiagram,
  recordDiagramDraftSchema,
  type RecordDiagramDraft,
} from "../lib/record-diagram"

const recordIdSchema = z.string().uuid()
const saveDiagramSchema = z.object({
  recordId: recordIdSchema,
  diagram: recordDiagramDraftSchema,
})

type DiagramActionResult =
  | { diagram: RecordDiagramDraft; error: null }
  | { diagram: null; error: string }

async function getAuthenticatedClient() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Not authenticated")
  return supabase
}

export async function getRecordDiagram(recordId: string): Promise<DiagramActionResult> {
  try {
    const id = recordIdSchema.parse(recordId)
    const supabase = await getAuthenticatedClient()
    const { data: record, error: recordError } = await supabase
      .from("records")
      .select("id, site_id")
      .eq("id", id)
      .maybeSingle()

    if (recordError) throw recordError
    if (!record) throw new Error("Record not found")

    const [{ data: diagram, error: diagramError }, { data: nodes, error: nodesError }, { data: edges, error: edgesError }] =
      await Promise.all([
        supabase
          .from("record_diagrams")
          .select("revision, viewport")
          .eq("record_id", id)
          .maybeSingle(),
        supabase
          .from("record_diagram_nodes")
          .select("id, kind, title, content, metadata, position_x, position_y")
          .eq("record_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("record_diagram_edges")
          .select("id, source_node_id, target_node_id, relation_type, label, metadata")
          .eq("record_id", id)
          .order("created_at", { ascending: true }),
      ])

    if (diagramError) throw diagramError
    if (nodesError) throw nodesError
    if (edgesError) throw edgesError

    if (!diagram) return { diagram: emptyRecordDiagram(), error: null }

    const parsed = recordDiagramDraftSchema.parse({
      revision: Number(diagram.revision || 0),
      viewport: diagram.viewport || { x: 0, y: 0, zoom: 1 },
      nodes: (nodes || []).map((node: any) => ({
        id: node.id,
        kind: node.kind,
        title: node.title,
        content: node.content || "",
        metadata: node.metadata || {},
        position: {
          x: Number(node.position_x || 0),
          y: Number(node.position_y || 0),
        },
      })),
      edges: (edges || []).map((edge: any) => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        type: edge.relation_type,
        label: edge.label || undefined,
        metadata: edge.metadata || {},
      })),
    })

    return { diagram: parsed, error: null }
  } catch (error) {
    console.error("[getRecordDiagram]", error)
    return {
      diagram: null,
      error: error instanceof Error ? error.message : "Failed to load diagram",
    }
  }
}

export async function saveRecordDiagram(rawInput: {
  recordId: string
  diagram: RecordDiagramDraft
}): Promise<
  | { success: true; revision: number; changedNodeIds: string[] }
  | { success: false; error: string; conflict?: boolean }
> {
  try {
    const input = saveDiagramSchema.parse(rawInput)
    const supabase = await getAuthenticatedClient()
    const { data: record, error: recordError } = await supabase
      .from("records")
      .select("id, site_id, title, category:record_categories!records_category_site_fkey(name)")
      .eq("id", input.recordId)
      .maybeSingle()

    if (recordError) throw recordError
    if (!record) throw new Error("Record not found")

    const { data: canUpdate, error: capabilityError } = await supabase.rpc("user_can", {
      p_site_id: record.site_id,
      p_command: "update",
    })
    if (capabilityError) throw capabilityError
    if (!canUpdate) throw new Error("Record not found or access denied")

    const category = Array.isArray(record.category) ? record.category[0] : record.category
    const nodes = input.diagram.nodes.map((node) => {
      const embeddingText = buildNodeEmbeddingText({
        recordTitle: record.title,
        categoryName: category?.name,
        node,
      })
      return {
        id: node.id,
        kind: node.kind,
        title: node.title,
        content: node.content,
        metadata: node.metadata,
        position_x: node.position.x,
        position_y: node.position.y,
        embedding_source_hash: createHash("sha256").update(embeddingText).digest("hex"),
      }
    })
    const edges = input.diagram.edges.map((edge) => ({
      id: edge.id,
      source_node_id: edge.source,
      target_node_id: edge.target,
      relation_type: edge.type,
      label: edge.label || null,
      metadata: edge.metadata,
    }))

    const service = await createServiceClient()
    const { data, error } = await service.rpc("save_record_diagram", {
      p_record_id: input.recordId,
      p_expected_revision: input.diagram.revision,
      p_viewport: input.diagram.viewport,
      p_nodes: nodes,
      p_edges: edges,
    })
    if (error) throw error

    const result = Array.isArray(data) ? data[0] : data
    revalidatePath(`/records/${input.recordId}`)
    revalidatePath("/records")
    after(async () => {
      try {
        await processRecordEmbeddingsById({ recordId: input.recordId })
      } catch (embeddingError) {
        console.error("[saveRecordDiagram] deferred embedding failed", embeddingError)
      }
    })
    return {
      success: true,
      revision: Number(result?.revision ?? input.diagram.revision + 1),
      changedNodeIds: result?.changed_node_ids || [],
    }
  } catch (error: any) {
    console.error("[saveRecordDiagram]", error)
    const message = error?.message || "Failed to save diagram"
    return {
      success: false,
      error: message,
      conflict: error?.code === "40001" || message.toLowerCase().includes("revision conflict"),
    }
  }
}
