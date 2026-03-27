"use server"

export async function fetchOutstandPosts(siteId: string) {
  try {
    const apiServerUrl = process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || 'http://localhost:3001';
    const res = await fetch(`${apiServerUrl}/api/integrations/outstand/posts?tenant_id=${siteId}`, {
      cache: 'no-store'
    });
    if (!res.ok) {
      console.error("fetchOutstandPosts error status:", res.status)
      return { data: [] };
    }
    const result = await res.json();
    return { data: result?.data || [] };
  } catch (error) {
    console.error("Failed to fetch outstand posts:", error);
    return { data: [] };
  }
}
