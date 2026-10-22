"use server";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requirePosSiteAccess } from "./site-access";
import { inspectPosPayment } from "../payment-recovery-server";
import type { PosCheckoutRecovery } from "../checkout-recovery-types";

const schema = z.object({
  siteId: z.string().uuid(), clientMutationId: z.string().min(1).max(128),
  existingOrderId: z.string().uuid().optional(), registerSessionId: z.string().uuid().optional(),
  payments: z.array(z.object({
    paymentId: z.string().uuid(), method: z.string().min(1).max(30),
    amount: z.number().finite().positive().max(999999999),
    tendered: z.number().finite().nonnegative().optional(), change: z.number().finite().nonnegative().optional(),
  }).strict()).max(50).refine((rows) => new Set(rows.map((p) => p.paymentId)).size === rows.length),
}).strict();

export async function reconcilePosCheckoutStatus(input: unknown): Promise<{ data: PosCheckoutRecovery; error?: never } | { data?: never; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid checkout recovery request. Keep the original operation for review." };
  try {
    const access = await requirePosSiteAccess(parsed.data.siteId);
    if (access.error || !access.user || !["owner", "admin", "collaborator"].includes(access.role)) {
      return { error: "Forbidden checkout recovery." };
    }
    // Authorized read-only service access also sees retained receipts/results after closure.
    const client = await createServiceClient(true, { access: "workspace" });
    return { data: await inspectPosPayment(client, parsed.data, access.user.id) };
  } catch {
    return { error: "Unable to verify payment status. No operation was changed. Try again or ask a manager to review it." };
  }
}