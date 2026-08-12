function publicPromptImageUrl(prompt: string, size = 1024): string {
  const apiServerUrl =
    process.env.NEXT_PUBLIC_API_SERVER_URL || "http://localhost:3001";
  return `${apiServerUrl}/api/public/image/prompt/${encodeURIComponent(
    prompt.trim(),
  )}?width=${size}&height=${size}`;
}

export function resolveItemImage(item: {
  image_url?: string | null;
  name: string;
  description?: string | null;
}): string {
  if (item.image_url) {
    return item.image_url;
  }
  // Use name only to avoid long URL 403s on backend
  return publicPromptImageUrl(item.name);
}

/** Same dynamic AI image API as catalog when a promotion has no uploaded image. */
export function resolvePromotionImage(promo: {
  image_url?: string | null;
  name?: string | null;
}): string {
  if (promo.image_url) return promo.image_url;
  return publicPromptImageUrl(promo.name?.trim() || "Promotion");
}
