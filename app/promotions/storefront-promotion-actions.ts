"use server"

import { getStorefrontPromotionDetail as _getStorefrontPromotionDetail } from "./storefront-promotions"

export async function getStorefrontPromotionDetail(params: {
  promotionId: string;
  siteId?: string;
}) {
  return _getStorefrontPromotionDetail(params);
}
