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
  try {
    const apiServerUrl = process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || 'http://localhost:3001';
    const res = await fetch(`${apiServerUrl}/api/integrations/outstand/posts?tenant_id=${siteId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    let data;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch(e) {
      throw new Error("Invalid response from server: " + text);
    }
    
    if (res.ok && data.success) {
      return { success: true, data };
    } else {
      return { success: false, error: data?.error || `Failed with status ${res.status}` };
    }
  } catch (error) {
    console.error("Failed to publish outstand post:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to publish content" };
  }
}
