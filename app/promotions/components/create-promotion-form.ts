import type { RelationSelectValue } from "@/app/components/ui/relation-select"
import type { PromotionChannel } from "@/app/types"
import { DEFAULT_PROMOTION_CHANNELS } from "../promotion-channels"

export type CreatePromotionFormData = {
  name: string
  code: string
  campaign_value: RelationSelectValue
  discount_type: "percent" | "fixed" | "bogo"
  discount_value: string
  bogo_buy_qty: number
  bogo_get_qty: number
  currency: string
  applies_to: "all" | "selected_items"
  channels: PromotionChannel[]
  location_ids: string[]
  min_order_amount?: number
  required_items_mode: "all" | "any"
  starts_at?: string
  ends_at?: string
  active_weekdays: number[]
}

export const EMPTY_CREATE_PROMOTION_FORM: CreatePromotionFormData = {
  name: "",
  code: "",
  campaign_value: null,
  discount_type: "percent",
  discount_value: "",
  bogo_buy_qty: 1,
  bogo_get_qty: 1,
  currency: "USD",
  applies_to: "all",
  channels: [...DEFAULT_PROMOTION_CHANNELS],
  location_ids: [],
  min_order_amount: undefined,
  required_items_mode: "all",
  starts_at: undefined,
  ends_at: undefined,
  active_weekdays: [],
}
