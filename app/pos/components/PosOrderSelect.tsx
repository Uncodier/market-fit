"use client";

import {
  RelationSelect,
  type RelationSelectValue,
} from "@/app/components/ui/relation-select";
import { Receipt } from "@/app/components/ui/icons";
import { formatPosOrderLabel } from "@/app/pos/order-label";
import {
  posOpenOrderGroupKey,
  selectPosOpenOrders,
} from "@/app/pos/open-orders";

export function PosOrderSelect({
  pendingOrders,
  activeOrderId,
  orderNotes = "",
  onOrderSelect,
  t,
  className,
}: {
  pendingOrders: any[];
  activeOrderId: string;
  orderNotes?: string;
  onOrderSelect: (val: string) => void;
  t: (key: string) => string;
  className?: string;
}) {
  const getTrans = (key: string, fallback: string) =>
    t(key) === key ? fallback : t(key);
  const openOrders = selectPosOpenOrders(pendingOrders);
  const groupLabels = {
    pending: getTrans("orders.status.pending", "Pending"),
    in_progress: getTrans("orders.status.in_progress", "In Progress"),
    completed: getTrans("pos.completedUnpaid", "Completed (unpaid)"),
  };
  const isNew = activeOrderId === "new";
  const selected = isNew
    ? undefined
    : openOrders.find((o: any) => o.id === activeOrderId);
  const currentLabel = formatPosOrderLabel(selected, t, orderNotes);
  const value: RelationSelectValue = isNew
    ? orderNotes.trim()
      ? { mode: "create", label: currentLabel }
      : null
    : {
        mode: "existing",
        id: activeOrderId,
        label: currentLabel,
      };

  return (
    <RelationSelect
      options={openOrders.map((o: any) => ({
        id: o.id,
        label: formatPosOrderLabel(
          o,
          t,
          o.id === activeOrderId ? orderNotes : undefined,
        ),
        searchText: [o.notes, o.leads?.name].filter(Boolean).join(" "),
        group: groupLabels[posOpenOrderGroupKey(o.status)],
      }))}
      value={value}
      onValueChange={(val) =>
        onOrderSelect(val?.mode === "create" || !val ? "new" : val.id)
      }
      placeholder={getTrans("pos.newOrder", "New Order")}
      searchPlaceholder={getTrans("pos.searchOrder", "Search order...")}
      emptyMessage={getTrans("pos.noPendingOrders", "No pending orders")}
      allowCreate={false}
      clearable={!isNew}
      icon={<Receipt className="h-4 w-4" />}
      pinnedAction={{
        label: getTrans("pos.newOrder", "New Order"),
        selected: isNew,
        onSelect: () => onOrderSelect("new"),
      }}
      className={className}
    />
  );
}
