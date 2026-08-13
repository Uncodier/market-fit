"use client";

import useSWR from "swr";
import { Card, CardContent } from "@/app/components/ui/card";
import { EmptyCard } from "@/app/components/ui/empty-card";
import { Activity } from "@/app/components/ui/icons";
import { useLocalization } from "@/app/context/LocalizationContext";
import { listPromotionRedemptions } from "@/app/promotions/list-redemptions";
import { displayPromotionUsageCount } from "@/app/promotions/redemption-map";
import { PromotionRedemptionsTable } from "./PromotionRedemptionsTable";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
}

export function PromotionPerformanceTab({
  siteId,
  promotionId,
  usageCount,
  usageLimit,
  currency = "USD",
}: {
  siteId: string;
  promotionId: string;
  usageCount?: number | null;
  usageLimit?: number | null;
  currency?: string;
}) {
  const { t } = useLocalization();
  const { data, isLoading } = useSWR(
    siteId && promotionId
      ? ["promotion_redemptions", siteId, promotionId]
      : null,
    () =>
      listPromotionRedemptions({
        siteId,
        promotionId,
        pageSize: 50,
      }),
  );

  const redemptions = data?.data || [];
  const listedCount = data?.count ?? redemptions.length;
  const uses = displayPromotionUsageCount(usageCount, listedCount);
  const discountGiven = redemptions.reduce(
    (sum, row) => sum + (row.discountTotal || 0),
    0,
  );

  const labels = {
    order: t("promotions.detail.performance.order") || "Order",
    customer: t("promotions.detail.performance.customer") || "Customer",
    discount: t("promotions.detail.performance.discount") || "Discount",
    total: t("promotions.detail.performance.total") || "Total",
    date: t("promotions.detail.performance.date") || "Date",
    unknownCustomer:
      t("promotions.detail.performance.unknownCustomer") || "Unknown customer",
  };

  if (!isLoading && uses === 0 && redemptions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyCard
          icon={<Activity className="h-10 w-10" />}
          title={
            t("promotions.detail.performanceTitle") || "Performance Metrics"
          }
          description={
            t("promotions.detail.performanceDescription") ||
            "Performance data for this promotion will appear here once it has been used."
          }
          variant="fancy"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">
              {t("promotions.detail.performance.uses") || "Uses"}
            </div>
            <div className="text-2xl font-semibold mt-1">
              {usageLimit ? `${uses} / ${usageLimit}` : uses}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">
              {t("promotions.detail.performance.discountGiven") ||
                "Discount given"}
            </div>
            <div className="text-2xl font-semibold mt-1">
              {formatMoney(discountGiven, currency)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-medium">
              {t("promotions.detail.performance.redemptions") || "Redemptions"}
              {listedCount > 0 ? ` (${listedCount})` : ""}
            </h3>
          </div>
          <PromotionRedemptionsTable
            redemptions={redemptions}
            loading={isLoading}
            emptyLabel={
              t("promotions.detail.performance.redemptionsEmpty") ||
              "No coupon redemptions yet."
            }
            loadingLabel={
              t("promotions.detail.performance.loading") ||
              "Loading redemptions..."
            }
            showPromoSubtitle={false}
            labels={labels}
          />
        </CardContent>
      </Card>
    </div>
  );
}
