"use server";

import { createClient } from "@/lib/supabase/server";

export type PosMutationKind = "checkout" | "check_in" | "create_lead";

export type PosMutationRecord = {
  id: string;
  site_id: string;
  client_mutation_id: string;
  kind: PosMutationKind;
  sale_id: string | null;
  order_id: string | null;
  lead_id: string | null;
  result: Record<string, any>;
};

export async function findPosClientMutation(
  siteId: string,
  clientMutationId: string,
): Promise<{ data: PosMutationRecord | null; error?: string }> {
  try {
    if (!clientMutationId) return { data: null };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pos_client_mutations")
      .select("*")
      .eq("site_id", siteId)
      .eq("client_mutation_id", clientMutationId)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: (data as PosMutationRecord) || null };
  } catch (e: any) {
    return { data: null, error: e?.message };
  }
}

export async function recordPosClientMutation(params: {
  siteId: string;
  clientMutationId: string;
  kind: PosMutationKind;
  saleId?: string | null;
  orderId?: string | null;
  leadId?: string | null;
  result?: Record<string, any>;
}): Promise<{ data: PosMutationRecord | null; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pos_client_mutations")
      .upsert(
        {
          site_id: params.siteId,
          client_mutation_id: params.clientMutationId,
          kind: params.kind,
          sale_id: params.saleId ?? null,
          order_id: params.orderId ?? null,
          lead_id: params.leadId ?? null,
          result: params.result ?? {},
        },
        { onConflict: "site_id,client_mutation_id" },
      )
      .select("*")
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as PosMutationRecord };
  } catch (e: any) {
    return { data: null, error: e?.message };
  }
}
