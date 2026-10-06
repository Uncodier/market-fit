"use server";

import { formatPromotionDiscountLabel } from "./bogo-discount";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSiteRole } from "@/lib/auth/api-site-access";
import { userCanOnSite } from "@/lib/permissions/site-access";
import { configuredApiUrl } from "@/lib/http/api-proxy-security";
import {
  promptImageCacheUrl,
  readImageResponse,
  readPromptImageCache,
} from "@/lib/images/prompt-image-cache";

const text = z.string().trim().max(200).refine(value => !/[\u0000-\u001f\u007f]/.test(value));
const quantity = z.number().int().min(1).max(10_000).nullish();
const inputSchema = z.object({
  siteId: z.string().uuid().transform(value => value.toLowerCase()),
  name: text.pipe(z.string().min(1)),
  discount_type: z.enum(["percent", "fixed", "bogo"]),
  discount_value: z.number().finite().min(0).max(1_000_000_000).nullish(),
  bogo_buy_qty: quantity,
  bogo_get_qty: quantity,
  siteName: text.nullish(),
}).strict().refine(value => value.discount_type !== "percent" || (value.discount_value ?? 0) <= 100);

/** Generate through the authorized API and persist only its confirmed public cache URL. */
export async function generatePromotionImage(params: {
  siteId: string;
  name: string;
  discount_type: string;
  discount_value?: number | null;
  bogo_buy_qty?: number | null;
  bogo_get_qty?: number | null;
  siteName?: string | null;
}): Promise<{ imageUrl: string } | { error: string }> {
  const parsed = inputSchema.safeParse(params);
  if (!parsed.success) return { error: "Invalid promotion image request." };
  const input = parsed.data;

  try {
    const supabase = await createClient(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "Please sign in to generate promotion images." };
    if (!await getCurrentUserSiteRole(supabase, input.siteId) ||
        !await userCanOnSite(supabase, input.siteId, "insert")) {
      return { error: "Image generation is not permitted for this site." };
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token || session.user?.id !== user.id) {
      return { error: "Please sign in again to generate promotion images." };
    }

    const label = formatPromotionDiscountLabel(input);
    const title = input.name.slice(0, 48);
    const site = (input.siteName || "").slice(0, 32);
    const imageInput = {
      prompt: `Promotional ecommerce banner for "${title}", offer ${label}${
        site ? `, brand ${site}` : ""
      }. Bold clean product photography style, no text overlays, square crop.`,
      width: 1024,
      height: 1024,
      site_id: input.siteId,
    };
    // The request origin is server-configured; neither input nor request headers select a fetch target.
    const target = configuredApiUrl(
      new Request(process.env.NEXT_PUBLIC_APP_URL || "https://app.makinari.com"),
      `/api/public/image/prompt/${encodeURIComponent(imageInput.prompt)}`,
    );
    const cacheUrl = promptImageCacheUrl(imageInput, input.siteId);
    if (!target || !cacheUrl) return { error: "Image generation is not configured." };
    target.search = new URLSearchParams({
      site_id: input.siteId, width: String(imageInput.width), height: String(imageInput.height),
    }).toString();
    const response = await fetch(target, {
      headers: { Authorization: `Bearer ${session.access_token}`, Accept: "image/*" },
      credentials: "omit", redirect: "error", cache: "no-store",
      signal: AbortSignal.timeout(240_000),
    });
    if (!await readImageResponse(response)) {
      return { error: "Promotion image generation could not be confirmed. Please try again later." };
    }
    // The API owns storage writes. Confirm persistence without replaying paid generation.
    if (!await readPromptImageCache(imageInput, input.siteId)) {
      return { error: "The promotion image could not be saved. Please try again later." };
    }
    return { imageUrl: cacheUrl.toString() };
  } catch {
    return { error: "Promotion image generation is temporarily unavailable. Please try again later." };
  }
}
