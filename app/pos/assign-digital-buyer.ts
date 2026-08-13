import type { BuyerUser } from "@/app/components/commerce/BuyerUserEmailField";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";

export function buyerUserFromLeads(
  buyerUserId: string | null | undefined,
  leads: {
    buyer_user_id?: string | null;
    email?: string | null;
    name?: string | null;
  }[],
): BuyerUser | null {
  if (!buyerUserId) return null;
  const lead = leads.find((l) => l.buyer_user_id === buyerUserId && l.email);
  if (!lead?.email) return null;
  return {
    buyerUserId,
    email: lead.email,
    name: lead.name || lead.email,
  };
}

export async function commitPosDigitalBuyer(params: {
  siteId: string;
  buyerUser: BuyerUser;
  handleLeadValueChange: (
    value: RelationSelectValue,
  ) => Promise<unknown>;
  setBuyerUserId: (id: string | null) => void;
  setLeads: (updater: (prev: any[]) => any[]) => void;
}) {
  const { findOrCreateLeadForBuyer } = await import(
    "@/app/commerce/resolve-buyer-lead"
  );
  const res = await findOrCreateLeadForBuyer({
    siteId: params.siteId,
    email: params.buyerUser.email,
    name: params.buyerUser.name,
    buyerUserId: params.buyerUser.buyerUserId,
  });
  if (res.error || !res.lead) {
    throw new Error(res.error || "Failed to link customer");
  }
  await params.handleLeadValueChange({
    mode: "existing",
    id: res.lead.id,
    label: res.lead.name || res.lead.email || params.buyerUser.email,
  });
  params.setBuyerUserId(params.buyerUser.buyerUserId);
  params.setLeads((prev) => {
    if (prev.some((l) => l.id === res.lead!.id)) return prev;
    return [res.lead, ...prev];
  });
}
