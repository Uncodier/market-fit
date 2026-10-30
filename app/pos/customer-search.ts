export type PosCustomer = {
  id: string;
  site_id?: string;
  name?: string | null;
  email?: string | null;
  personal_email?: string | null;
  phone?: string | null;
  company?: string | { name?: string | null } | null;
  companies?: { name?: string | null } | null;
};

export function posCustomerSearchText(lead: PosCustomer): string {
  return [lead.name, lead.email, lead.personal_email, lead.phone,
    typeof lead.company === "string" ? lead.company : lead.company?.name,
    lead.companies?.name].filter(Boolean).join(" ");
}