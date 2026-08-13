"use client";

import {
  RelationSelect,
  type RelationSelectValue,
} from "@/app/components/ui/relation-select";
import { Receipt } from "@/app/components/ui/icons";
import { formatPosOrderLabel } from "@/app/pos/order-label";

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
  const isNew = activeOrderId === "new";
  const selected = isNew
    ? undefined
    : pendingOrders.find((o: any) => o.id === activeOrderId);
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
      options={pendingOrders.map((o: any) => ({
        id: o.id,
        label: formatPosOrderLabel(
          o,
          t,
          o.id === activeOrderId ? orderNotes : undefined,
        ),
        searchText: [o.notes, o.leads?.name].filter(Boolean).join(" "),
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
