import type { RelationSelectValue } from "@/app/components/ui/relation-select";

export function hasPosCustomer(
  leadValue: RelationSelectValue | string | null | undefined,
): boolean {
  if (!leadValue) return false;
  if (typeof leadValue === "string") return leadValue.trim().length > 0;
  if (leadValue.mode === "existing") return Boolean(leadValue.id);
  if (leadValue.mode === "create") return Boolean(leadValue.label?.trim());
  return false;
}
