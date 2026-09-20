"use server";

import { after } from "next/server";
import { DynamicQuoteMetadata } from "@/app/types";
import {
  fetchTunneledInstanceLogs,
  getApiServerUrl,
} from "./dynamic-quote-api";
import { syncDynamicQuoteFromInstanceLogs } from "./dynamic-quote-sync";

const ASSISTANT_DEADLINE_MS = 90_000;
const POLL_INTERVAL_MS = 2_000;

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

async function tryApplyPrice(
  quotationItemId: string,
  logs?: Awaited<ReturnType<typeof fetchTunneledInstanceLogs>>["logs"]
): Promise<boolean> {
  const synced = await syncDynamicQuoteFromInstanceLogs(quotationItemId, logs);
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
    let applyInFlight: Promise<boolean> | null = null;

    const applyOnce = async (reason: string) => {
      if (resolved) return true;
      if (applyInFlight) return applyInFlight;

      applyInFlight = (async () => {
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

        const ok = await tryApplyPrice(
          params.quotationItemId,
          tunneled.logs
        );
        if (ok) resolved = true;
        return ok;
      })();

      try {
        return await applyInFlight;
      } finally {
        applyInFlight = null;
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      ASSISTANT_DEADLINE_MS
    );
    let stopPolling = false;
    const pollPromise = (async () => {
      while (!stopPolling && !resolved && !controller.signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (!stopPolling && !resolved && !controller.signal.aborted) {
          await applyOnce("tunneled_poll");
        }
      }
    })();

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
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Assistant API returned ${res.status}`);
      }

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
    } catch (err: unknown) {
      console.error("[dynamic-quote-resolve] assistant fetch error", {
        error: err instanceof Error ? err.message : String(err),
        instanceId: params.instanceId,
      });
      if (!controller.signal.aborted) {
        await applyOnce("fetch_error_fallback");
      }
    } finally {
      stopPolling = true;
      controller.abort();
      clearTimeout(timeout);
      await pollPromise;
      console.error("[dynamic-quote-resolve] finished", {
        instanceId: params.instanceId,
        quotationItemId: params.quotationItemId,
        resolved,
      });
    }
  });

  return { started: true };
}
