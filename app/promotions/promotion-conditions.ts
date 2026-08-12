import { toZonedTime } from "date-fns-tz";

export type RequiredPromoLine = {
  catalogItemId: string;
  categoryId?: string | null;
  quantity?: number;
};

export type PromoRequiredItemDef = {
  catalog_item_id: string;
  min_quantity: number;
};

export type PromoRequiredCategoryDef = {
  catalog_category_id: string;
  min_quantity: number;
};

/**
 * Checks if the promotion is active on the current weekday in the site's timezone.
 */
export function checkPromotionWeekday(params: {
  activeWeekdays?: number[] | null;
  timezone?: string | null;
}): string | null {
  const { activeWeekdays, timezone } = params;

  if (!activeWeekdays || activeWeekdays.length === 0) {
    return null;
  }

  const tz = timezone || "UTC";
  const now = new Date();

  try {
    const zonedNow = toZonedTime(now, tz);
    const currentWeekday = zonedNow.getDay();

    if (!activeWeekdays.includes(currentWeekday)) {
      return "Promotion is not active today";
    }

    return null;
  } catch (error) {
    console.error("Timezone error in promotion check:", error);
    const currentWeekday = now.getDay();
    if (!activeWeekdays.includes(currentWeekday)) {
      return "Promotion is not active today";
    }
    return null;
  }
}

/**
 * Validates required products and/or categories against the cart.
 * Mode ALL: every product and every category requirement must pass.
 * Mode ANY: at least one product or category requirement must pass.
 */
export function checkPromotionRequiredItems(params: {
  mode?: "all" | "any" | null;
  requiredItems?: PromoRequiredItemDef[] | null;
  requiredCategories?: PromoRequiredCategoryDef[] | null;
  lines: RequiredPromoLine[];
}): string | null {
  const {
    mode = "all",
    requiredItems = [],
    requiredCategories = [],
    lines,
  } = params;

  const items = requiredItems || [];
  const categories = requiredCategories || [];

  if (items.length === 0 && categories.length === 0) {
    return null;
  }

  const itemQuantities = new Map<string, number>();
  const categoryQuantities = new Map<string, number>();

  for (const line of lines) {
    const qty = Number(line.quantity) || 1;
    itemQuantities.set(
      line.catalogItemId,
      (itemQuantities.get(line.catalogItemId) || 0) + qty
    );
    if (line.categoryId) {
      categoryQuantities.set(
        line.categoryId,
        (categoryQuantities.get(line.categoryId) || 0) + qty
      );
    }
  }

  const validItems = items.filter((req) => {
    const cartQty = itemQuantities.get(req.catalog_item_id) || 0;
    return cartQty >= req.min_quantity;
  });

  const validCategories = categories.filter((req) => {
    const cartQty = categoryQuantities.get(req.catalog_category_id) || 0;
    return cartQty >= req.min_quantity;
  });

  const totalRequirements = items.length + categories.length;
  const totalValid = validItems.length + validCategories.length;

  if (mode === "all") {
    if (totalValid < totalRequirements) {
      return "Order does not include all required products or categories for this promotion";
    }
  } else if (mode === "any") {
    if (totalValid === 0) {
      return "Order must include at least one required product or category for this promotion";
    }
  }

  return null;
}
