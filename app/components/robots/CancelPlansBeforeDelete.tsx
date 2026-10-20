"use client"

import { useEffect, useState } from "react"
import { z } from "zod"
import { Button } from "@/app/components/ui/button"
import { cancelInstancePlan } from "@/app/components/simple-messages-view/hooks/cancel-instance-plan"

const responseSchema = z.object({
  success: z.literal(true), instance_id: z.string().uuid(),
  plans: z.array(z.object({ id: z.string().uuid(), title: z.string(), status: z.string(), active_steps: z.number().int().nonnegative().nullable() })).max(100),
})
type Plan = z.infer<typeof responseSchema>["plans"][number]

export function CancelPlansBeforeDelete({ instanceId, onBusyChange }: {
  instanceId: string; onBusyChange: (busy: boolean) => void
}) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/robots/plan/cancel?instance_id=${encodeURIComponent(instanceId)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Plan list unavailable")
        const result = responseSchema.parse(await response.json())
        if (result.instance_id !== instanceId) throw new Error("Plan scope mismatch")
        if (!controller.signal.aborted) setPlans(result.plans)
      }).catch(() => {
        if (!controller.signal.aborted) { setUnavailable(true); setMessage("Plan list unavailable. Refresh the page or open the instance to reconcile its execution.") }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [instanceId])

  const cancel = async (plan: Plan) => {
    if (cancelling) return
    setCancelling(plan.id); onBusyChange(true); setMessage(null)
    try {
      await cancelInstancePlan(plan.id, instanceId)
      setPlans(current => current.filter(p => p.id !== plan.id))
      setMessage("Plan and unfinished steps cancelled. Deletion has not been retried. Review the remaining plans, then choose Delete explicitly.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cancellation could not be confirmed. Refresh before trying again.")
    } finally { setCancelling(null); onBusyChange(false) }
  }
  return <span className="mt-4 block space-y-2">
    <span className="block font-medium text-foreground">Resolve plan execution before deletion</span>
    <span className="block">Installing the migration does not cancel existing plans. Cancel only work you intend to abandon. Active providers or leases must be stopped separately.</span>
    {loading && <span className="block">Loading plans…</span>}
    {!loading && !unavailable && plans.length === 0 && <span className="block">No cancellable plans remain. Other execution or ownership checks may still block deletion.</span>}
    {plans.map(plan => <span key={plan.id} className="flex items-center justify-between gap-2 rounded border p-2">
      <span><span className="block font-medium">{plan.title}</span><span className="block text-xs">{plan.status} · {plan.active_steps ?? "unknown"} active steps</span></span>
      <Button type="button" size="sm" variant="outline" disabled={cancelling !== null}
        aria-label={`Cancel plan ${plan.title}`} onClick={() => { void cancel(plan) }}>
        {cancelling === plan.id ? "Cancelling…" : "Cancel plan"}
      </Button>
    </span>)}
    {message && <span role="status" className="block">{message}</span>}
  </span>
}