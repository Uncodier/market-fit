import "server-only";

import { z } from "zod";
import { getSendGridConfig } from "@/app/documents/send-document-email";
import type { PosSyncErrorReport } from "./sync-error-report";

const mailboxSchema = z.string().max(254).email().regex(/^[\x21-\x7e]+$/);
const SEND_TIMEOUT_MS = 5000;

export function getPosSyncErrorEmailConfig() {
  const sendGrid = getSendGridConfig();
  const recipient = mailboxSchema.safeParse(process.env.POS_SYNC_ERROR_EMAIL);
  if (!sendGrid || !recipient.success || !mailboxSchema.safeParse(sendGrid.fromEmail).success) {
    return null;
  }
  return { ...sendGrid, recipient: recipient.data };
}

/** Arbitrary error prose may contain names, addresses or payloads: never forward it. */
function safeErrorDiagnostic(error: string): string {
  const message = error.toLowerCase();
  if (/timeout|timed out|aborterror/.test(message)) return "The sync operation timed out.";
  if (/network|failed to fetch|fetch failed|offline/.test(message)) return "A sync network request failed.";
  if (/not authenticated|unauthorized|forbidden|permission denied/.test(message)) {
    return "Sync authentication or authorization failed.";
  }
  if (/waiting for local (lead|order) to sync/.test(message)) return "A local sync dependency is not ready.";
  if (/being refreshed/.test(message)) return "Sync data is being refreshed.";
  if (/insufficient stock|out of stock|inventory|stock availability/.test(message)) {
    return "Sync inventory availability validation failed.";
  }
  if (/stale|order has changed|order changed|order was modified|version conflict/.test(message)) {
    return "Sync encountered a changed order or version conflict.";
  }
  if (/invalid ticket|ticket not found|ticket.*already.*checked|invalid.*ticket code/.test(message)) {
    return "Sync ticket check-in validation failed.";
  }
  if (/indexeddb|database|constraint|duplicate key/.test(message)) return "A sync storage operation failed.";
  return "The sync operation failed. Error details were redacted for privacy.";
}

export async function sendPosSyncErrorEmail(
  config: NonNullable<ReturnType<typeof getPosSyncErrorEmailConfig>>,
  report: PosSyncErrorReport,
  mutationFingerprint?: string,
): Promise<{ ok: true } | { error: string }> {
  const body = [
    "POS sync error report",
    `Site ID: ${report.siteId}`,
    `Operation: ${report.operation}`,
    ...(mutationFingerprint ? [`Mutation fingerprint (SHA-256): ${mutationFingerprint}`] : []),
    ...(report.attempts !== undefined ? [`Attempts: ${report.attempts}`] : []),
    `Error: ${safeErrorDiagnostic(report.error)}`,
    "",
    "Client-supplied error details and mutation IDs are not included. No outbox payload is included.",
  ].join("\n");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: config.recipient }] }],
        from: { email: config.fromEmail, ...(config.fromName ? { name: config.fromName } : {}) },
        subject: `POS sync error: ${report.operation}`,
        content: [{ type: "text/plain", value: body }],
      }),
    });
    if (!response.ok) return { error: "Unable to send POS sync error email" };
    // Provider acceptance is not proof of inbox delivery.
    return { ok: true };
  } catch {
    return { error: "Unable to send POS sync error email" };
  } finally {
    clearTimeout(timer);
  }
}