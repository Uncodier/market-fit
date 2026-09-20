import type { RelationSelectValue } from "@/app/components/ui/relation-select";

export type PosLeadSyncPlan = {
  resolvedLeadId: string | null;
  localLeadId: string | null;
  createLead: {
    localLeadId: string;
    name: string;
    clientMutationId: string;
  } | null;
};

export function hasPosCustomer(
  leadValue: RelationSelectValue | string | null | undefined,
): boolean {
  if (!leadValue) return false;
  if (typeof leadValue === "string") return leadValue.trim().length > 0;
  if (leadValue.mode === "existing") return Boolean(leadValue.id);
  if (leadValue.mode === "create") return Boolean(leadValue.label?.trim());
  return false;
}

export function planPosLeadSync(
  leadValue: RelationSelectValue,
  createId: () => string,
): PosLeadSyncPlan {
  if (!leadValue) {
    return {
      resolvedLeadId: null,
      localLeadId: null,
      createLead: null,
    };
  }

  if (leadValue.mode === "existing") {
    const isLocal = leadValue.id.startsWith("local_");
    return {
      resolvedLeadId: isLocal ? null : leadValue.id,
      localLeadId: isLocal ? leadValue.id : null,
      createLead: null,
    };
  }

  const name = leadValue.label.trim();
  if (!name) {
    return {
      resolvedLeadId: null,
      localLeadId: null,
      createLead: null,
    };
  }

  const localLeadId = `local_${createId()}`;
  return {
    resolvedLeadId: null,
    localLeadId,
    createLead: {
      localLeadId,
      name,
      clientMutationId: createId(),
    },
  };
}
