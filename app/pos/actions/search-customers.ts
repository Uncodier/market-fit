"use server";

import { z } from "zod";
import { requirePosSiteAccess } from "./site-access";
import type { PosCustomer } from "../customer-search";

const inputSchema = z.object({
  siteId: z.string().trim().min(1).max(200),
  query: z.string().trim().min(1).max(200),
});

export async function searchPosCustomers(siteId: string, query: string): Promise<
  { leads: PosCustomer[]; error?: string }
> {
  const input = inputSchema.safeParse({ siteId, query });
  if (!input.success) return { leads: [], error: "Enter a customer search of 1–200 characters." };
  try {
    const access = await requirePosSiteAccess(input.data.siteId);
    if (!access.supabase) return { leads: [], error: access.error };
    // Quote PostgREST logic values and escape LIKE wildcards for literal searches.
    const pattern = JSON.stringify(`%${input.data.query.replace(/[\\%_]/g, "\\$&")}%`);
    const fields = ["name", "email", "personal_email", "phone", "company->>name"];
    const { data, error } = await access.supabase.from("leads")
      .select("id, site_id, name, email, personal_email, phone, company, companies(name)")
      .eq("site_id", input.data.siteId)
      .or(fields.map((field) => `${field}.ilike.${pattern}`).join(","))
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return { leads: [], error: "Customer search is unavailable. Local customers remain available." };
    return { leads: (data || []) as PosCustomer[] };
  } catch {
    return { leads: [], error: "Customer search is unavailable. Local customers remain available." };
  }
}