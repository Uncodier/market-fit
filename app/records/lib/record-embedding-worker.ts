import "server-only"

import { getApiServerUrl } from "@/lib/api-server-url"

const REQUEST_TIMEOUT_MS = 55_000

type RecordEmbeddingResult = {
  processedJobs: number
  processedNodes: number
  remainingNodes: number
  stale: boolean
}

export async function processRecordEmbeddingsById(input: {
  recordId: string
  requestedNodeIds?: string[]
}): Promise<RecordEmbeddingResult> {
  const apiServerUrl = getApiServerUrl()
  const serviceApiKey = process.env.SERVICE_API_KEY?.trim()
  if (!apiServerUrl || !serviceApiKey) {
    throw new Error("Embedding service is not configured")
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(
      `${apiServerUrl.replace(/\/$/, "")}/api/records/embed`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": serviceApiKey,
        },
        body: JSON.stringify({
          record_id: input.recordId,
          changed_node_ids: input.requestedNodeIds,
        }),
        signal: controller.signal,
      }
    )
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message = payload && typeof payload.error === "string"
        ? payload.error
        : `Embedding API failed: ${response.status}`
      throw new Error(message)
    }
    return payload as RecordEmbeddingResult
  } finally {
    clearTimeout(timeout)
  }
}
