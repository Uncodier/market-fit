/**
 * Tunneled robots/API helpers (not a Server Actions module).
 * Keep non-async exports out of "use server" files.
 */

export function getApiServerUrl(): string {
  const base =
    process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_SERVER_URL || "";
  if (!base) return "";
  if (base.startsWith("http://") || base.startsWith("https://")) return base;
  const lower = base.toLowerCase();
  const isLocal =
    lower.startsWith("localhost") ||
    lower.startsWith("127.0.0.1") ||
    lower.startsWith("0.0.0.0");
  return `${isLocal ? "http" : "https"}://${base}`;
}

/**
 * Read instance_logs via the tunneled API (SERVICE_API_KEY).
 * API uses supabaseAdmin — shop buyers cannot read instance_logs via RLS.
 */
export type TunneledInstanceLog = {
  id: string;
  message?: string | null;
  log_type?: string;
  tool_name?: string | null;
  created_at?: string;
};

export async function fetchTunneledInstanceLogs(
  instanceId: string,
  limit = 100
): Promise<{
  logs: TunneledInstanceLog[];
  error?: string;
}> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(instanceId)) {
    return { logs: [], error: "Invalid instance ID" };
  }

  const serviceApiKey = process.env.SERVICE_API_KEY?.trim();
  if (!serviceApiKey) {
    return { logs: [], error: "SERVICE_API_KEY is not configured" };
  }

  const apiBase = getApiServerUrl();
  if (!apiBase) {
    return { logs: [], error: "API_SERVER_URL is not configured" };
  }

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const url = `${apiBase}/api/instances/${encodeURIComponent(instanceId)}/logs?limit=${safeLimit}&offset=0`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": serviceApiKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const message =
        data?.error?.message ||
        data?.error ||
        data?.message ||
        `API error ${res.status}`;
      console.error("[fetchTunneledInstanceLogs] failed", {
        instanceId,
        status: res.status,
        message,
      });
      return { logs: [], error: String(message) };
    }
    const logs = Array.isArray(data?.logs) ? data.logs : [];
    return { logs };
  } catch (err: unknown) {
    console.error("[fetchTunneledInstanceLogs] fetch error", {
      instanceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      logs: [],
      error: err instanceof Error ? err.message : "Failed to fetch instance logs",
    };
  }
}
