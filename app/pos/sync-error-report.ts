import { z } from "zod";

/** Diagnostic metadata only: never include an outbox payload or client recipient. */
export const posSyncErrorReportSchema = z.object({
  siteId: z.string().uuid().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  ).transform((value) => value.toLowerCase()),
  operation: z.enum([
    "catalog", "orders", "outbox", "checkout", "check_in", "create_lead", "update_order_notes",
  ]),
  error: z.string().trim().min(1).max(2000),
  clientMutationId: z.string().min(1).max(128)
    .regex(/^[\x20-\x7e]+$/).refine((value) => value.trim().length > 0).optional(),
  attempts: z.number().int().min(0).max(1_000_000).optional(),
}).strict();

export type PosSyncErrorReport = z.infer<typeof posSyncErrorReportSchema>;