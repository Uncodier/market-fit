"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table";
import { formatCurrency } from "@/app/lib/formatters";
import type { PromotionRedemption } from "@/app/promotions/redemption-map";
import { navigateToOrder } from "@/app/hooks/use-navigation-history";
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  documentRowAccent,
} from "@/app/components/documents/document-list";

export function PromotionRedemptionsTable({
  redemptions,
  loading,
  emptyLabel,
  loadingLabel,
  showPromoSubtitle = true,
  labels,
}: {
  redemptions: PromotionRedemption[];
  loading?: boolean;
  emptyLabel: string;
  loadingLabel: string;
  showPromoSubtitle?: boolean;
  labels: {
    order: string;
    customer: string;
    discount: string;
    total: string;
    date: string;
    unknownCustomer: string;
  };
}) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="px-4 pb-6 text-sm text-muted-foreground">
        {loadingLabel}
      </div>
    );
  }

  if (redemptions.length === 0) {
    return (
      <div className="px-4 pb-6 text-sm text-muted-foreground">{emptyLabel}</div>
    );
  }

  return (
    <Table className="min-w-[680px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <DocumentListHead className="w-[34%]">{labels.customer}</DocumentListHead>
          <DocumentListHead className="w-[18%]">{labels.date}</DocumentListHead>
          <DocumentListHead className="w-[20%]" align="right">{labels.discount}</DocumentListHead>
          <DocumentListHead className="w-[28%]" align="right">{labels.total}</DocumentListHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {redemptions.map((row) => {
          const promoLine = showPromoSubtitle
            ? [row.promotionCode || row.promotionName, row.source].filter(Boolean).join(" · ")
            : row.source;
          return (
            <DocumentListRow
              key={row.id}
              onClick={() =>
                navigateToOrder({
                  orderId: row.id,
                  orderNumber: row.orderNumber,
                  router,
                })
              }
              accent={documentRowAccent(row.status, 0)}
            >
              <TableCell className="py-3.5">
                <EntityCell
                  name={row.customerName || labels.unknownCustomer}
                  secondary={row.orderNumber}
                  meta={promoLine || null}
                />
              </TableCell>
              <TableCell className="py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                {format(new Date(row.createdAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="py-3.5 text-right text-sm tabular-nums text-muted-foreground">
                {formatCurrency(row.discountTotal, row.currency)}
              </TableCell>
              <TableCell className="py-3.5">
                <MoneyCell amountLabel={formatCurrency(row.total, row.currency)} />
              </TableCell>
            </DocumentListRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
