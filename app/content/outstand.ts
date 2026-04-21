"use server"

export async function fetchOutstandPosts(siteId: string) {
  try {
    const apiServerUrl = process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || 'http://localhost:3001';
    const res = await fetch(`${apiServerUrl}/api/integrations/outstand/posts?tenant_id=${siteId}&limit=50`, {
      cache: 'no-store'
    });
    if (!res.ok) {
      console.error("fetchOutstandPosts error status:", res.status)
      return { data: [] };
    }
    const result = await res.json();
    return { data: result?.posts || result?.data || [] };
  } catch (error) {
    console.error("Failed to fetch outstand posts:", error);
    return { data: [] };
  }
}

export async function publishOutstandPost(siteId: string, payload: {
  tenant_id: string;
  containers: {
    content: string;
    media: any[];
  }[];
  accounts: string[];
  scheduledAt?: string;
}) {
  const apiServerUrl = process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || 'http://localhost:3001';
  const url = `${apiServerUrl}/api/integrations/outstand/posts?tenant_id=${siteId}`;

  console.log("[publishOutstandPost] -> request", {
    url,
    siteId,
    accounts: payload.accounts,
    containersCount: payload.containers?.length,
    contentLengths: payload.containers?.map(c => c?.content?.length ?? 0),
    contentPreviews: payload.containers?.map(c => (c?.content || '').slice(0, 200)),
    mediaCount: payload.containers?.map(c => Array.isArray(c?.media) ? c.media.length : 0),
    scheduledAt: payload.scheduledAt,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log("[publishOutstandPost] <- response", {
      status: res.status,
      ok: res.ok,
      statusText: res.statusText,
      contentType: res.headers.get('content-type'),
      bodyLength: text?.length ?? 0,
      bodyPreview: text?.slice(0, 1000),
    });

    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error("[publishOutstandPost] JSON parse error:", e, "rawBody:", text);
      throw new Error("Invalid response from server: " + text);
    }

    if (res.ok && data.success) {
      console.log("[publishOutstandPost] success", {
        postId: data?.post?.id || data?.data?.id || data?.id,
        socialAccounts: (data?.post?.socialAccounts || data?.data?.socialAccounts || data?.socialAccounts || []).map((a: any) => ({
          platform: a?.platform,
          platformPostId: a?.platformPostId,
          status: a?.status,
          error: a?.error,
        })),
      });
      return { success: true, data };
    } else {
      console.error("[publishOutstandPost] non-ok response", {
        status: res.status,
        success: data?.success,
        error: data?.error,
        message: data?.message,
        details: data?.details,
        data,
      });
      return {
        success: false,
        error: data?.error || data?.message || `Failed with status ${res.status} ${res.statusText || ''}`.trim(),
        details: data?.details ?? data,
        status: res.status,
      };
    }
  } catch (error) {
    console.error("[publishOutstandPost] fetch/throw error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to publish content" };
  }
}
