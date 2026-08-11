"use server";

import { findOrCreateLead } from "@/app/leads/actions";
import {
  findPosClientMutation,
  recordPosClientMutation,
} from "@/app/pos/actions/idempotency";

export async function createLeadWithIdempotency(params: {
  siteId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  clientMutationId: string;
}): Promise<{ lead?: any; error?: string; idempotent?: boolean }> {
  const existing = await findPosClientMutation(
    params.siteId,
    params.clientMutationId,
  );
  if (existing.data?.lead_id) {
    return {
      lead: { id: existing.data.lead_id, ...(existing.data.result?.lead || {}) },
      idempotent: true,
    };
  }

  const res = await findOrCreateLead(params.siteId, params.name);
  if (res.error || !res.lead) {
    return { error: res.error || "Failed to create lead" };
  }

  await recordPosClientMutation({
    siteId: params.siteId,
    clientMutationId: params.clientMutationId,
    kind: "create_lead",
    leadId: res.lead.id,
    result: {
      lead: { id: res.lead.id, name: res.lead.name, email: res.lead.email },
    },
  });

  return { lead: res.lead };
}
