import "server-only";

import { checkoutCart } from "@/app/commerce/checkout";
import { authorizeCheckoutBoundary } from "@/app/commerce/checkout-boundary";
import { createLeadWithIdempotency } from "./actions/create-lead-sync";
import { getPosOrder } from "./actions/get-order";
import { requirePosSiteAccess } from "./actions/site-access";
import {
  getActiveRegisterForPayment, getRegisterDashboard, getRegisterSummary,
  openRegister, closeRegister, moveRegisterCash,
} from "./register/actions";
import { hasPosCheckoutReferenceAccess } from "./operation-checkout-access";
import { posOperationSchema, type PosOperation } from "./operation-schemas";
import { parsePosOperationSuccess, posOperationRecoverySchema } from "./operation-response";

const UNCONFIRMED = "Unable to confirm the POS operation. Keep the original attempt and check its status before retrying.";
const safeErrors = new Set([
  "Open a register before collecting payment.",
  "Select a register location before collecting payment.",
  "This shift belongs to another cashier. Ask a manager to close it first.",
  "Cash Register is unavailable. The database migration must be installed.",
  "This register already has an open shift, or the request was already recorded. Refresh and try again.",
  "You do not have permission to use this register.",
  "The register changed or the operation is invalid. Refresh the register and try again.",
  "Unable to load or update the register. Please try again.",
  "Register session not found.",
  "This order or its balance has changed. Reload it before payment.",
  "The register shift is closed or unavailable. Refresh before collecting payment.",
  "Payment location does not match the register.",
  "This register shift belongs to another cashier.",
  "This payment is not linked to a valid register shift. Open Cash Register in Options before collecting payment.",
  "Selected seller is not an active site member",
]);
const recoveryMessages = {
  completed: "Checkout confirmed. No additional payment was collected.",
  not_found: "Payment outcome is not confirmed. Preserve this attempt and review it before collecting again.",
  processing: "Checkout is unresolved or still processing. Keep its original payment IDs.",
  rejected: "Rejected before checkout writes. Reload and review the order before confirming a new attempt.",
  payment_recorded: "Payment recorded. Do not collect it again. Checkout finalization still requires review; other orders can continue.",
  review_required: "Payment outcome is not confirmed. Preserve this attempt and review it before collecting again.",
};
type BoundaryResult = { status: number; body: unknown };
const failure = (status: number, error: string): BoundaryResult => ({ status, body: { error } });

function actionResult(operation: PosOperation, result: unknown): BoundaryResult {
  if (result && typeof result === "object" && "error" in result && result.error) {
    const error = result.error;
    if (error === "Not authenticated") return failure(401, "Not authenticated");
    if (["Forbidden", "Forbidden POS payment.", "You do not have permission to use Cash Register.",
      "This operation requires unrestricted location access"].includes(String(error))) return failure(403, "Forbidden POS operation.");
    if (operation.operation === "checkout" && "recovery" in result) {
      const recovery = posOperationRecoverySchema.safeParse(result.recovery);
      if (recovery.success) {
        const message = recoveryMessages[recovery.data.state];
        return { status: 409, body: { error: message, recovery: { ...recovery.data, message } } };
      }
    }
    if (operation.operation === "register" && "code" in result) {
      if (result.code === "register_required" || result.code === "register_location_required") return {
        status: 409, body: { error: result.code === "register_required"
          ? "Open a register before collecting payment." : "Select a register location before collecting payment.", code: result.code },
      };
    }
    if (error === "Unable to load POS order") return failure(404, error);
    return failure(safeErrors.has(String(error)) ? 409 : 500, safeErrors.has(String(error)) ? String(error) : UNCONFIRMED);
  }
  const success = parsePosOperationSuccess(operation.operation, result, operation.input);
  return success ? { status: 200, body: success } : failure(502, UNCONFIRMED);
}

/** Every HTTP operation authorizes independently; actions repeat their existing checks. */
export async function executePosOperation(input: unknown): Promise<BoundaryResult> {
  const parsed = posOperationSchema.safeParse(input);
  if (!parsed.success) return failure(400, "Invalid POS operation request.");
  const operation = parsed.data;
  try {
    const access = await requirePosSiteAccess(operation.input.siteId);
    const requiresCashier = operation.operation.startsWith("register") ||
      (operation.operation === "checkout" && !!operation.input.payments?.length);
    if (access.error || !access.user || (requiresCashier && !["owner", "admin", "collaborator"].includes(access.role))) {
      return failure(access.error === "Not authenticated" ? 401 : 403, access.error === "Not authenticated"
        ? "Not authenticated" : "Forbidden POS operation.");
    }
    let result: unknown;
    switch (operation.operation) {
      case "checkout": {
        if (operation.input.userId && operation.input.userId !== access.user.id) return failure(403, "POS account changed.");
        if (!await hasPosCheckoutReferenceAccess(access, operation.input)) return failure(403, "POS checkout references are not available for this site.");
        const authorized = await authorizeCheckoutBoundary({ ...operation.input, userId: access.user.id });
        result = await checkoutCart(authorized.params);
        break;
      }
      case "create-lead": result = await createLeadWithIdempotency(operation.input); break;
      case "order": result = await getPosOrder(operation.input.siteId, operation.input.orderId); break;
      case "register": result = await getActiveRegisterForPayment(operation.input); break;
      case "register-dashboard": result = await getRegisterDashboard(operation.input); break;
      case "register-summary": result = await getRegisterSummary(operation.input); break;
      case "register-open": result = await openRegister(operation.input); break;
      case "register-close": result = await closeRegister(operation.input); break;
      case "register-move": result = await moveRegisterCash(operation.input); break;
    }
    return actionResult(operation, result);
  } catch { return failure(500, UNCONFIRMED); }
}