import { Promotion, CatalogItem } from "@/app/types"

export interface PromotionParams {
  siteId: string;
  campaignId?: string;
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface PromotionWithCampaign extends Promotion {
  campaigns?: { title: string };
}
