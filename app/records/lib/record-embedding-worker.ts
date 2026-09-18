import "server-only"

import { createHash } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"
import {
  buildNodeEmbeddingText,
  serializeRecordDiagramSemanticText,
  type RecordDiagramContext,
  type RecordDiagramNode,
} from "./record-diagram"

const EMBEDDING_MODEL = "text-embedding-3-small"
const MAX_NODES_PER_RUN = 8
const EMBEDDING_CONCURRENCY = 4
const EXTERNAL_REQUEST_TIMEOUT_MS = 10_000

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

type EmbeddingJob = {
  id: string
  diagram_revision: number
  node_ids: string[]
  attempts: number
}
type EmbeddingNode = Pick<RecordDiagramNode, "id" | "kind" | "title" | "content" | "metadata"> & {
  embedding_source_hash: string | null
}

export async function enqueueRecordEmbeddingJob(
  recordId: string,
  nodeIds: string[] = [],
  replace = false,
  existingService?: ServiceClient
) {
  const service = existingService || await createServiceClient()
  const { error } = await service.rpc("enqueue_record_embedding_job", {
    p_record_id: recordId,
    p_node_ids: nodeIds,
    p_replace: replace,
  })
  if (error) throw error
}

export async function processRecordEmbeddingsById(input: {
  recordId: string
  requestedNodeIds?: string[]
}) {
  const service = await createServiceClient()
  const { data: record, error: recordError } = await service
    .from("records")
    .select("id, site_id, title, record_embedding_revision, category:record_categories!records_category_site_fkey(name)")
    .eq("id", input.recordId)
    .maybeSingle()
  if (recordError) throw recordError
  if (!record) throw new Error("Record not found")

  const apiServerUrl = (process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || "").trim()
  const serviceApiKey = process.env.SERVICE_API_KEY?.trim()
  if (!apiServerUrl || !serviceApiKey) {
    throw new Error("Embedding service is not configured")
  }

  const jobs = await claimEmbeddingJobs(service, input.recordId)
  const { data: diagram, error: diagramError } = await service
    .from("record_diagrams")
    .select("revision")
    .eq("record_id", input.recordId)
    .maybeSingle()
  if (diagramError) throw diagramError

  const currentRevision = Number(diagram?.revision || 0)
  const requestedIds = input.requestedNodeIds || []
  const queuedIds = jobs.flatMap((job) => job.node_ids || [])
  const allNodeIds = [...new Set([...requestedIds, ...queuedIds])]
  const nodeIds = allNodeIds.slice(0, MAX_NODES_PER_RUN)
  const remainingNodeIds = allNodeIds.slice(MAX_NODES_PER_RUN)

  try {
    let nodes: EmbeddingNode[] = []
    if (nodeIds.length > 0) {
      const { data, error } = await service
        .from("record_diagram_nodes")
        .select("id, kind, title, content, metadata, embedding_source_hash")
        .eq("record_id", input.recordId)
        .in("id", nodeIds)
      if (error) throw error
      nodes = (data || []) as unknown as EmbeddingNode[]
    }

    const staleNodeIds: string[] = []
    await mapWithConcurrency(nodes, EMBEDDING_CONCURRENCY, async (node) => {
      const embeddingText = buildNodeEmbeddingText({
        recordTitle: record.title,
        categoryName: readCategoryName(record.category),
        node,
      })
      const nextSourceHash = createHash("sha256").update(embeddingText).digest("hex")
      const embedding = await requestEmbedding(
        embeddingText,
        apiServerUrl,
        serviceApiKey
      )
      const { data: saved, error: saveError } = await service.rpc(
        "save_record_diagram_node_embedding",
        {
          p_record_id: input.recordId,
          p_node_id: node.id,
          p_diagram_revision: currentRevision,
          p_record_revision: record.record_embedding_revision,
          p_embedding_source_hash: node.embedding_source_hash,
          p_new_embedding_source_hash: nextSourceHash,
          p_embedding: embedding,
          p_embedding_model: EMBEDDING_MODEL,
        }
      )
      if (saveError) throw saveError
      if (!saved) staleNodeIds.push(node.id)
    })

    const summary = await requestSummary(
      input.recordId,
      record.site_id,
      apiServerUrl,
      serviceApiKey
    )
    const { data: diagramContext, error: contextError } = await service
      .rpc("get_record_diagram_context", { p_record_id: input.recordId })
    if (contextError) throw contextError

    const aggregateText = [
      summary,
      diagramContext
        ? serializeRecordDiagramSemanticText(diagramContext as RecordDiagramContext)
        : "",
    ].filter(Boolean).join("\n\n")
    const aggregateEmbedding = await requestEmbedding(
      aggregateText,
      apiServerUrl,
      serviceApiKey
    )
    const { data: aggregateSaved, error: aggregateError } = await service.rpc(
      "save_record_aggregate_embedding",
      {
        p_record_id: input.recordId,
        p_diagram_revision: currentRevision,
        p_record_revision: record.record_embedding_revision,
        p_summary: summary,
        p_embedding: aggregateEmbedding,
      }
    )
    if (aggregateError) throw aggregateError

    const retryNodeIds = [...new Set([...remainingNodeIds, ...staleNodeIds])]
    if (retryNodeIds.length > 0 || !aggregateSaved) {
      await enqueueRecordEmbeddingJob(input.recordId, retryNodeIds, true, service)
    }
    await finishJobs(service, jobs, null)

    return {
      processedJobs: jobs.length,
      processedNodes: nodes.length,
      remainingNodes: retryNodeIds.length,
      stale: !aggregateSaved || staleNodeIds.length > 0,
    }
  } catch (error) {
    await finishJobs(
      service,
      jobs,
      error instanceof Error ? error.message.slice(0, 2000) : "Embedding failed"
    )
    throw error
  }
}

async function claimEmbeddingJobs(
  service: ServiceClient,
  recordId: string
): Promise<EmbeddingJob[]> {
  const { data, error } = await service.rpc("claim_record_embedding_jobs", {
    p_record_id: recordId,
    p_limit: 5,
  })
  if (error) throw error
  return (data || []) as EmbeddingJob[]
}

async function finishJobs(
  service: ServiceClient,
  jobs: EmbeddingJob[],
  error: string | null
) {
  if (jobs.length === 0) return
  const { error: updateError } = await service
    .from("record_embedding_jobs")
    .update({
      status: error ? "failed" : "completed",
      last_error: error,
      completed_at: error ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", jobs.map((job) => job.id))
    .eq("status", "processing")
  if (updateError) throw updateError
}

async function requestSummary(
  recordId: string,
  siteId: string,
  apiServerUrl: string,
  serviceApiKey: string
) {
  const data = await requestJson(`${apiServerUrl.replace(/\/$/, "")}/api/ai/summary`, {
    source: { collection: "records", id: recordId },
    site_id: siteId,
  }, serviceApiKey)
  if (!data.summary || typeof data.summary !== "string") {
    throw new Error("Summary service returned no text")
  }
  return data.summary
}

async function requestEmbedding(text: string, apiServerUrl: string, serviceApiKey: string) {
  const data = await requestJson(
    `${apiServerUrl.replace(/\/$/, "")}/api/ai/embeddings`,
    { input: text, modelId: EMBEDDING_MODEL },
    serviceApiKey
  )
  if (!Array.isArray(data.embedding) || data.embedding.length !== 1536) {
    throw new Error("Embedding service returned an invalid vector")
  }
  return data.embedding as number[]
}

async function requestJson(url: string, body: unknown, serviceApiKey: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": serviceApiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`AI service failed: ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>
) {
  for (let index = 0; index < values.length; index += concurrency) {
    await Promise.all(values.slice(index, index + concurrency).map(worker))
  }
}

function readCategoryName(category: unknown): string | null {
  if (Array.isArray(category)) return category[0]?.name || null
  if (category && typeof category === "object" && "name" in category) {
    return String((category as { name: unknown }).name || "") || null
  }
  return null
}
