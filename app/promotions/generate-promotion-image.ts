"use server";

import { formatPromotionDiscountLabel } from "./bogo-discount";
import { resolvePromotionImage } from "@/app/lib/image-utils";

/**
 * Builds a merchandising image for a promotion.
 * Tries AI gateway when configured; falls back to the same dynamic
 * `/api/public/image/prompt/...` URL used by catalog items.
 */
export async function generatePromotionImage(params: {
  name: string;
  discount_type: string;
  discount_value?: number | null;
  bogo_buy_qty?: number | null;
  bogo_get_qty?: number | null;
  siteName?: string | null;
}): Promise<{ imageUrl: string } | { error: string }> {
  const label = formatPromotionDiscountLabel(params);
  const title = (params.name || "Promotion").trim().slice(0, 48);
  const site = (params.siteName || "").trim().slice(0, 32);
  const prompt = `Promotional ecommerce banner for "${title}", offer ${label}${
    site ? `, brand ${site}` : ""
  }. Bold clean product photography style, no text overlays, square crop.`;

  try {
    const gatewayKey = process.env.VERCEL_AI_GATEWAY_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();

    if (gatewayKey || openaiKey) {
      const endpoint = gatewayKey
        ? "https://ai-gateway.vercel.sh/v1/images/generations"
        : "https://api.openai.com/v1/images/generations";
      const apiKey = gatewayKey || openaiKey!;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const b64 = json?.data?.[0]?.b64_json;
        if (b64) {
          return { imageUrl: `data:image/png;base64,${b64}` };
        }
        const url = json?.data?.[0]?.url;
        if (url) return { imageUrl: String(url) };
      }
    }
  } catch (err) {
    console.error("Promotion AI image generation failed, using prompt API fallback", err);
  }

  return { imageUrl: resolvePromotionImage({ name: title, image_url: null }) };
}
