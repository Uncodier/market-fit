import "server-only";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requirePosSiteAccess } from "./actions/site-access";
import { inspectPosPayment } from "./payment-recovery-server";
import type { PosCheckoutRecovery } from "./checkout-recovery-types";

const schema = z.object({
  siteId: z.string().uuid(), clientMutationId: z.string().min(1).max(128),
  existingOrderId: z.string().uuid().optional(), registerSessionId: z.string().uuid().optional(),
  payments: z.array(z.object({
    paymentId: z.string().uuid(), method: z.string().min(1).max(30),
    amount: z.number().finite().positive().max(999999999),
    tendered: z.number().finite().nonnegative().optional(), change: z.number().finite().nonnegative().optional(),
  }).strict()).max(50).refine((rows) => new Set(rows.map((p) => p.paymentId)).size === rows.length),
}).strict();

type StatusResult =
  | { status: 200; body: { data: PosCheckoutRecovery; error?: never } }
  | { status: 400 | 401 | 403 | 500; body: { data?: never; error: string } };

/** Shared security boundary for the action and HTTP read; middleware is not authorization. */
export async function readPosCheckoutStatus(input: unknown): Promise<StatusResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { status: 400, body: {
    error: "Invalid checkout recovery request. Keep the original operation for review.",
  } };
  try {
    const access = await requirePosSiteAccess(parsed.data.siteId);
    if (access.error || !access.user || !["owner", "admin", "collaborator"].includes(access.role)) {
      return { status: access.error === "Not authenticated" ? 401 : 403, body: { error: "Forbidden checkout recovery." } };
    }
    // Unchanged authorized read-only service access also sees retained receipts after closure.
    const client = await createServiceClient(true, { access: "workspace" });
    return { status: 200, body: { data: await inspectPosPayment(client, parsed.data, access.user.id) } };
  } catch {
    return { status: 500, body: {
      error: "Unable to verify payment status. No operation was changed. Try again or ask a manager to review it.",
    } };
  }
}