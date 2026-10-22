import type { PosCheckoutRecovery } from "./checkout-recovery-types";

type StatusResponse = { data: PosCheckoutRecovery; error?: never } | { data?: never; error: string };
const TIMEOUT_MS = 8_000;
const unavailable = "Unable to verify payment status. Keep the original operation and try again.";

function isRecovery(value: unknown): value is PosCheckoutRecovery {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<PosCheckoutRecovery>;
  if (!data.state || !["completed", "not_found", "processing", "rejected", "payment_recorded", "review_required"].includes(data.state) ||
    typeof data.message !== "string") return false;
  return data.state !== "completed" || (data.result?.success === true &&
    typeof data.result.orderId === "string" && !!data.result.orderId &&
    typeof data.result.saleId === "string" && !!data.result.saleId);
}

/** Only the status read is abortable; never abort or replay the checkout mutation. */
export async function fetchPosCheckoutStatus(input: unknown): Promise<StatusResponse> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<StatusResponse>((resolve) => {
    timer = setTimeout(() => {
      // Settle even if a browser/network adapter fails to reject on abort.
      resolve({ error: "Payment status check timed out. Keep the original operation and try again." });
      controller.abort();
    }, TIMEOUT_MS);
  });
  const read = async (): Promise<StatusResponse> => {
    try {
      const response = await fetch("/api/pos/checkout-status", {
        method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: controller.signal,
      });
      if (!response.ok) return { error: response.status === 401 || response.status === 403
        ? "Checkout recovery requires authorized POS access." : unavailable };
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("data" in body) || !isRecovery(body.data)) return { error: unavailable };
      return { data: body.data };
    } catch { return { error: unavailable }; }
  };
  try {
    return await Promise.race([read(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}