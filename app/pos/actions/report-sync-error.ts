"use server";

import { checkRateLimit, hashRedisKeyPart } from "@/lib/redis/control-plane";
import { posSyncErrorReportSchema } from "@/app/pos/sync-error-report";
import { getPosSyncErrorEmailConfig, sendPosSyncErrorEmail } from "@/app/pos/sync-error-email";
import { requirePosSiteAccess } from "./site-access";

const WINDOW_SECONDS = 15 * 60;
const UNAVAILABLE = "POS sync error reporting is temporarily unavailable";

export async function reportPosSyncError(input: unknown): Promise<{ ok: true } | { error: string }> {
  try {
    const parsed = posSyncErrorReportSchema.safeParse(input);
    if (!parsed.success) return { error: "Invalid POS sync error report" };
    const report = parsed.data;
    const access = await requirePosSiteAccess(report.siteId);
    if ("error" in access) {
      return { error: access.error === "Not authenticated" ? "Not authenticated" : "Forbidden" };
    }

    const config = getPosSyncErrorEmailConfig();
    if (!config) return { error: "POS sync error email is not configured" };

    const siteHash = await hashRedisKeyPart(report.siteId);
    const userHash = await hashRedisKeyPart(access.user.id);
    const mutationHash = report.clientMutationId
      ? await hashRedisKeyPart(report.clientMutationId) : undefined;
    const policies = [
      { key: `rl:v1:pos-sync-error:report:${siteHash}:${report.operation}:${mutationHash ?? "none"}`, limit: 1 },
      { key: `rl:v1:pos-sync-error:site:${siteHash}`, limit: 10 },
      { key: `rl:v1:pos-sync-error:user:${userHash}`, limit: 10 },
    ];
    // Admission is counted before sending, including failed provider attempts.
    // Changing error prose or attempt counts cannot bypass same-report suppression.
    // Suppress repeats first so automatic retries do not exhaust aggregate limits.
    for (const policy of policies) {
      const admission = await checkRateLimit(policy.key, {
        limit: policy.limit, windowSeconds: WINDOW_SECONDS, failureMode: "closed",
      });
      if (admission.unavailable) return { error: UNAVAILABLE };
      if (!admission.allowed) return { error: "POS sync error report limit reached. Try again later." };
    }
    return await sendPosSyncErrorEmail(config, report, mutationHash);
  } catch {
    return { error: UNAVAILABLE };
  }
}