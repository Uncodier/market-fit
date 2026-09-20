"use server";

import { createClient as createClientAdmin } from "@supabase/supabase-js";
import { DynamicQuoteMetadata } from "@/app/types";
import type { TunneledInstanceLog } from "./dynamic-quote-api";
import {
  findAssistantInstanceForQuote,
  syncDynamicQuoteFromInstanceLogs,
} from "./dynamic-quote-sync";
import { isValidQuotationPublicToken } from "@/app/quotations/public-token";
import { isPublicAccessTokenActive } from "@/app/documents/public-token";

export type DynamicQuoteProgressLog = {
  id: string;
  logType: "thinking" | "tool_call" | "agent_action" | "status";
  text: string;
  createdAt: string;
};

function adminClient() {
  return createClientAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function humanizeToolName(name: string): string {
  const cleaned = name.replace(/_/g, " ").trim();
  if (!cleaned) return "tool";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function toProgressLog(row: {
  id: string;
  log_type: string;
  message?: string | null;
  tool_name?: string | null;
  created_at: string;
}): DynamicQuoteProgressLog | null {
  const message = (row.message || "").trim();
  const createdAt = row.created_at;

  if (row.log_type === "thinking") {
    if (!message) return null;
    return {
      id: row.id,
      logType: "thinking",
      text: message.length > 280 ? `${message.slice(0, 277)}…` : message,
      createdAt,
    };
  }

  if (row.log_type === "tool_call") {
    const tool =
      row.tool_name ||
      (message.includes(":") ? message.split(":")[0] : message) ||
      "tool";
    return {
      id: row.id,
      logType: "tool_call",
      text: `Using ${humanizeToolName(String(tool))}`,
      createdAt,
    };
  }

  if (row.log_type === "agent_action") {
    if (!message) return null;
    if (/"unit_price"\s*:/.test(message)) {
      return {
        id: row.id,
        logType: "agent_action",
        text: "Quote calculated",
        createdAt,
      };
    }
    // Skip generic parent step shells; thinking/tool rows carry the signal.
    if (/^assistant step/i.test(message) || message.length < 8) return null;
    return {
      id: row.id,
      logType: "agent_action",
      text: message.length > 220 ? `${message.slice(0, 217)}…` : message,
      createdAt,
    };
  }

  return null;
}

function loadProgressLogs(
  logs: TunneledInstanceLog[]
): DynamicQuoteProgressLog[] {
  const relevant = logs
    .filter((row) =>
      ["thinking", "tool_call", "agent_action"].includes(String(row.log_type || ""))
    )
    .slice()
    .reverse(); // API returns newest-first; feed wants chronological

  return relevant
    .map((row) =>
      toProgressLog({
        id: row.id,
        log_type: row.log_type || "",
        message: row.message,
        tool_name: row.tool_name,
        created_at: row.created_at || new Date().toISOString(),
      })
    )
    .filter(Boolean) as DynamicQuoteProgressLog[];
}

/**
 * Single poll for PDP: sync price from agent_action logs + return live progress feed.
 */
export async function pollDynamicQuoteProgress(
  quotationItemId: string,
  progressAccessToken: string
) {
  if (!isValidQuotationPublicToken(progressAccessToken)) {
    return { error: "Quote progress is not available" };
  }

  const admin = adminClient();
  const { data: item, error } = await admin
    .from("quotation_items")
    .select(`
      id,
      metadata,
      quotation:quotations(
        site_id,
        public_access_token,
        public_access_token_expires_at,
        public_access_token_revoked_at
      )
    `)
    .eq("id", quotationItemId)
    .single();

  if (error || !item) {
    return { error: "Quote progress is not available" };
  }

  const quotation = (Array.isArray(item.quotation)
    ? item.quotation[0]
    : item.quotation) as {
    site_id?: string;
    public_access_token?: string | null;
    public_access_token_expires_at?: string | null;
    public_access_token_revoked_at?: string | null;
  } | null;
  if (
    quotation?.public_access_token !== progressAccessToken ||
    !isPublicAccessTokenActive(quotation)
  ) {
    return { error: "Quote progress is not available" };
  }

  const meta = (item.metadata?.dynamic_quote || {}) as DynamicQuoteMetadata;
  const siteId = quotation.site_id;

  let instanceId = meta.assistant_instance_id || null;
  if (!instanceId && siteId) {
    instanceId = await findAssistantInstanceForQuote({
      siteId,
      quotationItemId,
      attempts: 2,
    });
  }

  const synced = await syncDynamicQuoteFromInstanceLogs(quotationItemId);
  // Keep polling on transient apply errors if we still have processing data.
  if (synced.error && !synced.data) {
    return { error: synced.error };
  }

  const resolvedInstanceId =
    (synced.data && "assistantInstanceId" in synced.data
      ? (synced.data.assistantInstanceId as string | undefined)
      : undefined) ||
    instanceId ||
    undefined;

  const sourceLogs =
    synced.data && "sourceLogs" in synced.data
      ? (synced.data.sourceLogs as TunneledInstanceLog[])
      : [];
  let logs = resolvedInstanceId ? loadProgressLogs(sourceLogs) : [];

  if (
    logs.length === 0 &&
    (synced.data?.status === "processing" || !synced.data?.status)
  ) {
    logs = [
      {
        id: "bootstrap",
        logType: "status",
        text: "Starting quote assistant…",
        createdAt: new Date().toISOString(),
      },
    ];
  }

  return {
    data: {
      ...synced.data,
      assistantInstanceId: resolvedInstanceId || null,
      logs,
    },
  };
}
