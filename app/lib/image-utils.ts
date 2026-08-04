export function resolveItemImage(item: { image_url?: string | null, name: string, description?: string | null }): string {
  if (item.image_url) {
    return item.image_url;
  }
  const prompt = item.name.trim(); // Use name only to avoid long URL 403s on backend
  const apiServerUrl = process.env.NEXT_PUBLIC_API_SERVER_URL || 'http://localhost:3001';
  return `${apiServerUrl}/api/public/image/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024`;
}
