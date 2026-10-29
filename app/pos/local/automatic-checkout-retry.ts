import type { PosOutboxRow } from "./types";
import { posOperationIdentitySchema } from "../operation-schemas";

/** Only newly stamped operations use the durable-admission resend protocol. */
export function supportsAutomaticCheckoutRetry(row: PosOutboxRow): boolean {
  return row.payload.kind === "checkout" && posOperationIdentitySchema.safeParse(row.payload.data.posOperationIdentity).success;
}

export function checkoutRetryDelay(attempts: number): number {
  return Math.min(300_000, 5_000 * 2 ** Math.min(6, Math.max(0, attempts - 1)));
}