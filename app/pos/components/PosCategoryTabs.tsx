"use client";

import { useMemo } from "react";
import {
  ResponsiveTabsList,
  type TabItem,
} from "@/app/components/ui/responsive-tabs-list";
import type { CatalogCategory, CatalogItem } from "@/app/types";

interface PosCategoryTabsProps {
  activeCategory: string;
  availableItems: CatalogItem[];
  categories: CatalogCategory[];
  onCategoryChange: (category: string) => void;
  t: (key: string) => string;
  unavailableItems: CatalogItem[];
}

export function PosCategoryTabs({
  activeCategory,
  availableItems,
  categories,
  onCategoryChange,
  t,
  unavailableItems,
}: PosCategoryTabsProps) {
  const tabs = useMemo<TabItem[]>(() => {
    const hasKind = (kind: CatalogItem["kind"]) =>
      availableItems.some((item) => item.kind === kind && !item.parent_id);
    const visibleCategories = categories.filter((category) =>
      availableItems.some(
        (item) => item.category_id === category.id && !item.parent_id,
      ),
    );

    return [
      { value: "all", label: t("pos.filters.all") || "All" },
      ...(hasKind("product")
        ? [{ value: "kind_product", label: t("pos.filters.products") || "Products" }]
        : []),
      ...(hasKind("service")
        ? [{ value: "kind_service", label: t("pos.filters.services") || "Services" }]
        : []),
      ...(hasKind("digital_asset")
        ? [{ value: "kind_digital_asset", label: t("pos.filters.digitalAssets") || "Digital" }]
        : []),
      ...visibleCategories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
      ...(unavailableItems.some((item) => !item.parent_id)
        ? [{ value: "unavailable", label: t("pos.filters.unavailable") || "Unavailable" }]
        : []),
    ];
  }, [availableItems, categories, t, unavailableItems]);

  return (
    <ResponsiveTabsList
      tabs={tabs}
      activeTab={activeCategory}
      onTabChange={onCategoryChange}
      className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex-nowrap w-full md:max-w-full justify-start items-center gap-2 md:gap-0"
      triggerClassName="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-1 md:py-1 md:px-1 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent"
    />
  );
}
