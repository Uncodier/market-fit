"use server";

import { after } from "next/server";
import { DynamicQuoteMetadata } from "@/app/types";
import {
  fetchTunneledInstanceLogs,
  getApiServerUrl,
} from "./dynamic-quote-api";
import { syncDynamicQuoteFromInstanceLogs } from "./dynamic-quote-sync";

async function consumeResponseBody(res: Response) {
  if (!res.body) {
    await res.text().catch(() => "");
    return;
  }
  const reader = res.body.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

async function tryApplyPrice(quotationItemId: string): Promise<boolean> {
  const synced = await syncDynamicQuoteFromInstanceLogs(quotationItemId);
  const unitPrice = synced.data?.unitPrice;
  const status = synced.data?.status;
  const applied =
    typeof unitPrice === "number" &&
    unitPrice > 0 &&
    (status === "priced" || status === "awaiting_authorization");
  if (applied) {
    console.error("[dynamic-quote-resolve] price applied from instance_logs", {
      quotationItemId,
      unitPrice,
      status,
    });
  }
  return applied;
}

export type ScheduleAssistantQuoteParams = {
  instanceId: string;
  quotationItemId: string;
  siteId: string;
  ownerUserId: string;
  message: string;
  systemPrompt: string;
  revisionCount: number;
  context: Record<string, unknown>;
  metadata: DynamicQuoteMetadata;
};

/**
 * After the server action returns (SERVICE_API_KEY / service-role path):
 *  a) poll tunneled GET /api/instances/:id/logs while the assistant runs
 *  b) await full assistant response, then fetch all instance_logs again and apply
 */
export async function scheduleAssistantQuoteResolution(
  params: ScheduleAssistantQuoteParams
): Promise<{ started: true } | { started: false; error: string }> {
  const serviceApiKey = process.env.SERVICE_API_KEY?.trim();
  if (!serviceApiKey) {
    return { started: false, error: "SERVICE_API_KEY is not configured" };
  }

  const apiBase = getApiServerUrl();
  if (!apiBase) {
    return { started: false, error: "API_SERVER_URL is not configured" };
  }

  const url = `${apiBase}/api/robots/instance/assistant`;

  const body = {
    instance_id: params.instanceId,
    message: params.message,
    site_id: params.siteId,
    user_id: params.ownerUserId,
    system_prompt: params.systemPrompt,
    expected_results_amount: params.revisionCount,
    context: JSON.stringify(params.context),
  };

  console.error("[dynamic-quote-resolve] scheduling after() (tunneled)", {
    instanceId: params.instanceId,
    quotationItemId: params.quotationItemId,
    url,
  });

  after(async () => {
    let resolved = false;

    const applyOnce = async (reason: string) => {
      if (resolved) return true;
      // Warm the log cache path via tunnel (service key) before sync/apply.
      const tunneled = await fetchTunneledInstanceLogs(params.instanceId, 100);
      console.error("[dynamic-quote-resolve] tunneled logs", {
        reason,
        instanceId: params.instanceId,
        count: tunneled.logs.length,
        error: tunneled.error,
        hasUnitPrice: tunneled.logs.some((l) =>
          String(l.message || "").includes("unit_price")
        ),
      });

      const ok = await tryApplyPrice(params.quotationItemId);
      if (ok) resolved = true;
      return ok;
    };

    // a) Server-side "subscription": poll tunneled instance logs with SERVICE_API_KEY
    // while the assistant SSE is in flight (RLS-safe; API uses supabaseAdmin).
    const pollId = setInterval(() => {
      void applyOnce("tunneled_poll");
    }, 2000);

    try {
      console.error("[dynamic-quote-resolve] calling assistant API", {
        instanceId: params.instanceId,
      });
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": serviceApiKey,
        },
        body: JSON.stringify(body),
      });

      console.error("[dynamic-quote-resolve] assistant headers", {
        status: res.status,
        contentType: res.headers.get("content-type"),
        workflowRunId: res.headers.get("X-Workflow-Run-Id"),
      });

      await consumeResponseBody(res);

      console.error("[dynamic-quote-resolve] assistant response finished", {
        instanceId: params.instanceId,
      });

      // b) End of API response → fetch all instance_logs via tunnel and apply.
      await applyOnce("response_end");

      if (!resolved) {
        for (let i = 0; i < 8 && !resolved; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          await applyOnce(`grace_${i + 1}`);
        }
      }
    } catch (err: any) {
      console.error("[dynamic-quote-resolve] assistant fetch error", {
        error: err?.message || String(err),
        instanceId: params.instanceId,
      });
      await applyOnce("fetch_error_fallback");
    } finally {
      clearInterval(pollId);
      console.error("[dynamic-quote-resolve] finished", {
        instanceId: params.instanceId,
        quotationItemId: params.quotationItemId,
        resolved,
      });
    }
  });

  return { started: true };
}
