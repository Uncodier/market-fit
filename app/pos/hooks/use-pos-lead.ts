"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import { enqueueCreateLead } from "@/app/pos/local/outbox";
import { getPosDb } from "@/app/pos/local/db";

type LeadRecord = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type Args = {
  siteId?: string;
  leads: LeadRecord[];
  setLeads: (updater: (prev: any[]) => any[]) => void;
  reloadLeads: () => void | Promise<void>;
  leadValue: RelationSelectValue | string | null;
  setLeadValue: (value: RelationSelectValue | string | null) => void;
  setBuyerUserId: (value: string | null) => void;
  t: (key: string) => string;
};

function leadLabel(lead: LeadRecord): string {
  const leadName = lead.name?.trim() || "";
  let companyName = "";
  if ((lead as any).companies?.name?.trim()) companyName = (lead as any).companies.name.trim();
  else if (typeof (lead as any).company === 'object' && (lead as any).company?.name?.trim()) companyName = (lead as any).company.name.trim();
  else if (typeof (lead as any).company === 'string' && (lead as any).company.trim()) companyName = (lead as any).company.trim();

  let displayName = "";
  if (leadName && companyName && leadName !== companyName && leadName !== lead.phone) {
    displayName = `${leadName} (${companyName})`;
  } else if (companyName && (!leadName || leadName === lead.phone)) {
    displayName = companyName;
  } else {
    displayName = leadName || companyName || "";
  }

  const parts = Array.from(new Set([displayName, lead.name, lead.email, lead.phone].filter(Boolean)));
  return parts.length > 0
    ? parts.join(" · ")
    : lead.id;
}

export function usePosLead({
  siteId,
  leads,
  setLeads,
  reloadLeads,
  leadValue,
  setLeadValue,
  setBuyerUserId,
  t,
}: Args) {
  const leadRelationValue: RelationSelectValue =
    typeof leadValue === "string"
      ? { mode: "existing", id: leadValue, label: leadValue }
      : leadValue;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const leadIdParam = params.get("leadId");
    const buyerUserParam = params.get("buyerUserId");
    if (leadIdParam) setLeadValue(leadIdParam);
    if (buyerUserParam) setBuyerUserId(buyerUserParam);
    if (leadIdParam || buyerUserParam) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof leadValue !== "string") return;
    const lead = leads.find((l) => l.id === leadValue);
    if (!lead) return;
    setLeadValue({
      mode: "existing",
      id: lead.id,
      label: leadLabel(lead),
    });
  }, [leadValue, leads, setLeadValue]);

  const handleLeadUpdated = (lead: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  }) => {
    setLeadValue({
      mode: "existing",
      id: lead.id,
      label: leadLabel(lead),
    });
    void reloadLeads();
  };

  const handleLeadValueChange = async (
    value: RelationSelectValue,
  ): Promise<RelationSelectValue | null> => {
    if (!siteId || !value) {
      setLeadValue(value);
      return value;
    }
    if (value.mode === "create" && !navigator.onLine) {
      const localLeadId = `local_${uuidv4()}`;
      const clientMutationId = uuidv4();
      await getPosDb().leads.put({
        id: localLeadId,
        site_id: siteId,
        name: value.label.trim(),
        is_local: true,
      });
      await enqueueCreateLead(siteId, {
        siteId,
        localLeadId,
        name: value.label.trim(),
        clientMutationId,
      });
      setLeads((prev) => [
        {
          id: localLeadId,
          site_id: siteId,
          name: value.label.trim(),
          is_local: true,
        },
        ...prev,
      ]);
      const committed: RelationSelectValue = {
        mode: "existing",
        id: localLeadId,
        label: value.label.trim(),
      };
      setLeadValue(committed);
      toast.message(
        t("pos.sync.pendingLead") ||
          "Customer saved locally. Will sync when online.",
      );
      return committed;
    }
    setLeadValue(value);
    return value;
  };

  return {
    leadRelationValue,
    handleLeadUpdated,
    handleLeadValueChange,
  };
}
