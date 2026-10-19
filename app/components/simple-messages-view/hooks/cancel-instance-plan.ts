import { z } from "zod"

const id = z.string().uuid()
const receipt = z.object({
  success: z.literal(true),
  data: z.object({ plan_id: id, instance_id: id, status: z.literal("cancelled"), steps_cancelled: z.number().int().nonnegative() }),
})
const messages: Record<number, string> = {
  401: "Please sign in again to cancel this plan.",
  403: "Only project owners and admins can cancel plans.",
  404: "Plan not found. Refresh the instance before trying again.",
  409: "Stop and reconcile active execution before cancelling this plan. No plan changes were committed.",
  503: "Plan cancellation is unavailable. Check the database migration and refresh before trying again.",
}

export async function cancelInstancePlan(planId: string, instanceId: string) {
  if (!id.safeParse(planId).success || !id.safeParse(instanceId).success) {
    throw new Error("Provide valid plan and instance IDs.")
  }
  // Never fall back to status-only writes or replay an unconfirmed mutation.
  const response = await fetch("/api/robots/plan/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_id: planId, instance_id: instanceId }),
  })
  if (!response.ok) throw new Error(messages[response.status] ?? "Plan cancellation could not be confirmed. Refresh before trying again.")
  const result = receipt.safeParse(await response.json())
  if (!result.success || result.data.data.plan_id !== planId || result.data.data.instance_id !== instanceId) {
    throw new Error("Plan cancellation could not be confirmed. Refresh before trying again.")
  }
  return result.data.data
}