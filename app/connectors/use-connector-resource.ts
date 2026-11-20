"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { z } from "zod"
import { connectorRequest, ConnectorRequestError } from "./connector-request"

export function useConnectorResource<T>(path: string, schema: z.ZodType<T>) {
  const [version, setVersion] = useState(0)
  const key = `${path}:${version}`
  const [state, setState] = useState<{ key: string; data?: T; error?: unknown }>({ key: "" })
  const reload = useCallback(() => setVersion(value => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    let live = true
    connectorRequest(path, schema, { signal: controller.signal }).then(
      data => { if (live) setState({ key, data }) },
      error => { if (live) setState({ key, error }) },
    )
    return () => { live = false; controller.abort() }
  }, [path, schema, key])
  const isCurrent = state.key === key
  return {
    data: isCurrent ? state.data : undefined,
    error: isCurrent ? state.error : undefined,
    previousData: isCurrent ? undefined : state.data,
    reload,
  }
}

export function useConnectorMutation() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>()
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  async function run<T>(path: string, body: unknown, schema: z.ZodType<T>, method = "POST"): Promise<T | undefined> {
    if (controller.current) return
    const request = new AbortController()
    controller.current = request
    setPending(true)
    setError(undefined)
    try {
      const result = await connectorRequest(path, schema, { method, body: JSON.stringify(body), signal: request.signal })
      if (!request.signal.aborted) return result
    } catch (failure) {
      if (!request.signal.aborted) setError(failure instanceof Error ? failure : new ConnectorRequestError("outcome_unknown"))
    } finally {
      if (!request.signal.aborted) setPending(false)
      controller.current = null
    }
  }
  return { pending, error, run }
}

export const mutationResultSchema = z.unknown().transform(value => value ?? {})