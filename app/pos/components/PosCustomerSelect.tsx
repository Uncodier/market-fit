"use client";

import { useState } from "react";
import {
  RelationSelect,
  RelationSelectValue,
} from "@/app/components/ui/relation-select";
import { User } from "@/app/components/ui/icons";
import { PosLeadDetailsDialog } from "./PosLeadDetailsDialog";

function getLeadDisplayName(lead: any): string {
  // Extract name and company name
  const leadName = lead.name?.trim() || "";
  let companyName = "";
  
  if (lead.companies?.name?.trim()) {
    companyName = lead.companies.name.trim();
  } else if (typeof lead.company === 'object' && lead.company?.name?.trim()) {
    companyName = lead.company.name.trim();
  } else if (typeof lead.company === 'string' && lead.company.trim()) {
    companyName = lead.company.trim();
  }

  // If both exist and are different, combine them (or if leadName is just the phone number, companyName is better)
  if (leadName && companyName && leadName !== companyName && leadName !== lead.phone) {
    return `${leadName} (${companyName})`;
  } else if (companyName && (!leadName || leadName === lead.phone)) {
    return companyName;
  }
  
  return leadName || companyName || "";
}

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
  clearable = true,
  placeholder,
}: {
  leads: any[];
  leadValue: RelationSelectValue | string | null;
  setLeadValue: (value: RelationSelectValue) => void;
  siteId?: string;
  onLeadUpdated?: (lead: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  }) => void;
  t: (key: string) => string;
  clearable?: boolean;
  placeholder?: string;
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
          const displayName = getLeadDisplayName(l);
          
          let companySearchStr = "";
          if (l.companies?.name?.trim()) companySearchStr = l.companies.name;
          else if (typeof l.company === 'object' && l.company?.name?.trim()) companySearchStr = l.company.name;
          else if (typeof l.company === 'string' && l.company.trim()) companySearchStr = l.company;

          const parts = Array.from(new Set([displayName, l.name, l.email, l.phone].filter(Boolean)));
          const label =
            parts.length > 0
              ? parts.join(" · ")
              : t("pos.cart.customer") || "Customer";
              
          const searchText = Array.from(new Set([
            displayName, 
            l.name,
            companySearchStr,
            l.email, 
            l.personal_email, 
            l.phone
          ].filter(Boolean))).join(" ");
          
          return {
            id: l.id,
            label,
            searchText,
          };
        })}
        value={typeof leadValue === "string" ? null : leadValue}
        onValueChange={setLeadValue}
        clearable={clearable}
        placeholder={
          placeholder || t("pos.cart.walkIn") || "Walk-in Customer"
        }
        searchPlaceholder={
          t("pos.cart.searchCustomer") ||
          "Search by name, email, or phone..."
        }
        emptyMessage={t("pos.cart.noCustomers") || "No customers found"}
        className="bg-card"
        icon={<User className="h-4 w-4" />}
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
