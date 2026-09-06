import { getApiServerUrl } from "@/lib/api-server-url"

type RemoteStopResult = {
  attempted: boolean
  ok: boolean
  via?: "assistant_cancel" | "instance_stop"
  status?: number
}

async function postRemote(
  apiBase: string,
  path: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  return { ok: res.ok, status: res.status }
}

export async function stopRemoteAssistantWorkflow(params: {
  accessToken: string
  instanceId: string
  userLogId?: string | null
  requestId?: string | null
}): Promise<RemoteStopResult> {
  const apiBase = getApiServerUrl()
  if (!apiBase) {
    return { attempted: false, ok: true }
  }

  const payload = {
    instance_id: params.instanceId,
    user_log_id: params.userLogId || undefined,
    request_id: params.requestId || undefined,
  }

  try {
    const cancel = await postRemote(
      apiBase,
      "/api/robots/instance/assistant/cancel",
      params.accessToken,
      payload
    )
    if (cancel.ok) {
      return { attempted: true, ok: true, via: "assistant_cancel", status: cancel.status }
    }

    if (cancel.status === 404) {
      const stop = await postRemote(
        apiBase,
        "/api/robots/instance/stop",
        params.accessToken,
        { instance_id: params.instanceId }
      )
      return {
        attempted: true,
        ok: stop.ok,
        via: "instance_stop",
        status: stop.status,
      }
    }

    return { attempted: true, ok: false, via: "assistant_cancel", status: cancel.status }
  } catch (error) {
    console.error("Failed to stop remote assistant workflow:", error)
    return { attempted: true, ok: false }
  }
}
