"use client";

import { useState } from "react";
import {
  RelationSelect,
  RelationSelectValue,
} from "@/app/components/ui/relation-select";
import { PosLeadDetailsDialog } from "./PosLeadDetailsDialog";

function getSelectedLeadId(
  leadValue: RelationSelectValue | string | null | undefined,
): string | null {
  if (!leadValue) return null;
  if (typeof leadValue === "string") return leadValue;
  if (leadValue.mode === "existing") return leadValue.id;
  return null;
}

export function PosCustomerSelect({
  leads,
  leadValue,
  setLeadValue,
  siteId,
  onLeadUpdated,
  t,
}: {
  leads: any[];
  leadValue: RelationSelectValue | string;
  setLeadValue: (value: RelationSelectValue) => void;
  siteId?: string;
  onLeadUpdated?: (lead: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  }) => void;
  t: (key: string) => string;
}) {
  const [leadDetailsOpen, setLeadDetailsOpen] = useState(false);
  const selectedLeadId = getSelectedLeadId(leadValue);
  const getTrans = (key: string, fallback: string) =>
    t(key) === key ? fallback : t(key);
  const canOpenDetails = Boolean(selectedLeadId && siteId);

  return (
    <>
      <RelationSelect
        options={leads.map((l) => {
          const parts = [l.name, l.email, l.phone].filter(Boolean);
          const label =
            parts.length > 0
              ? parts.join(" · ")
              : t("pos.cart.customer") || "Customer";
          const searchText = [l.name, l.email, l.personal_email, l.phone]
            .filter(Boolean)
            .join(" ");
          return {
            id: l.id,
            label,
            searchText,
          };
        })}
        value={typeof leadValue === "string" ? null : leadValue}
        onValueChange={setLeadValue}
        placeholder={t("pos.cart.walkIn") || "Walk-in Customer"}
        searchPlaceholder={
          t("pos.cart.searchCustomer") ||
          "Search by name, email, or phone..."
        }
        emptyMessage={t("pos.cart.noCustomers") || "No customers found"}
        className="bg-card"
        endAction={
          <button
            type="button"
            disabled={!canOpenDetails}
            onClick={() => {
              if (!canOpenDetails) return;
              setLeadDetailsOpen(true);
            }}
            className="h-7 px-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {getTrans("details", "Details")}
          </button>
        }
      />

      {siteId && (
        <PosLeadDetailsDialog
          open={leadDetailsOpen}
          onOpenChange={setLeadDetailsOpen}
          leadId={selectedLeadId}
          siteId={siteId}
          t={t}
          onSaved={onLeadUpdated}
        />
      )}
    </>
  );
}
