"use server";

import { readPosCheckoutStatus } from "../checkout-status-boundary";
import type { PosCheckoutRecovery } from "../checkout-recovery-types";

export async function reconcilePosCheckoutStatus(input: unknown): Promise<{ data: PosCheckoutRecovery; error?: never } | { data?: never; error: string }> {
  return (await readPosCheckoutStatus(input)).body;
}