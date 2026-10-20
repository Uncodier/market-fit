import { act, fireEvent, render, renderHook, screen } from "@testing-library/react"
import { usePlanRunActions } from "@/app/components/simple-messages-view/hooks/usePlanRunActions"
import { StepIndicator } from "@/app/components/simple-messages-view/components/StepIndicator"
import { InstancePlan, PlanStep } from "@/app/components/simple-messages-view/types"
import { createClient } from "@/lib/supabase/client"

const toast = jest.fn()
jest.mock("@/app/components/ui/use-toast", () => ({ useToast: () => ({ toast }) }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
const planId = "00000000-0000-4000-8000-000000000001"
const instanceId = "00000000-0000-4000-8000-000000000002"
const receipt = { success: true, data: { plan_id: planId, instance_id: instanceId, status: "cancelled", steps_cancelled: 1 } }
beforeEach(() => { jest.clearAllMocks(); jest.mocked(fetch).mockReset(); jest.spyOn(console,"error").mockImplementation(() => {}) })
afterEach(() => jest.restoreAllMocks())
it("uses the authenticated cancellation route without direct status-only writes", async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => receipt } as Response)
  const { result } = renderHook(() => usePlanRunActions({ id: instanceId }))
  await act(async () => { await result.current.cancelPlan(planId) })
  expect(fetch).toHaveBeenCalledWith("/api/robots/plan/cancel", expect.objectContaining({ body: JSON.stringify({ plan_id: planId, instance_id: instanceId }) }))
  expect(createClient).not.toHaveBeenCalled()
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Plan cancelled" }))
})
it.each([409,503,502])("never claims success or retries failure %s", async status => {
  jest.mocked(fetch).mockResolvedValue({ ok: false, status } as Response)
  const { result } = renderHook(() => usePlanRunActions({ id: instanceId }))
  await act(async () => { await result.current.cancelPlan(planId) })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(createClient).not.toHaveBeenCalled()
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }))
})
it("rejects a mismatched receipt and lost response", async () => {
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ ...receipt, data: { ...receipt.data, plan_id: instanceId } }) } as Response)
  const { result } = renderHook(() => usePlanRunActions({ id: instanceId }))
  await act(async () => { await result.current.cancelPlan(planId) })
  jest.mocked(fetch).mockRejectedValueOnce(new Error("connection lost"))
  await act(async () => { await result.current.cancelPlan(planId) })
  expect(toast.mock.calls.every(([value]) => value.variant === "destructive")).toBe(true)
  expect(fetch).toHaveBeenCalledTimes(2)
})
it("targets the displayed paused plan, not another active plan", () => {
  const onCancelPlan = jest.fn()
  const plan = (id: string, status: InstancePlan["status"]) => ({ id, title: "Plan", status } as InstancePlan)
  const currentStep: PlanStep = { id: "step_1", title: "Current", status: "in_progress", order: 1, planId }
  render(<StepIndicator steps={[currentStep]} currentStep={currentStep} instancePlans={[plan(instanceId,"in_progress"),plan(planId,"paused")]}
    allCompleted={false} expanded onToggleExpanded={jest.fn()} onTogglePause={jest.fn()} onToggleResume={jest.fn()}
    onCancelPlan={onCancelPlan} onEditStep={jest.fn()} onDeleteStep={jest.fn()} onToggleStepStatus={jest.fn()} canEditOrDeleteStep={() => false} />)
  fireEvent.click(screen.getByRole("button", { name: "Cancel plan" }))
  expect(onCancelPlan).toHaveBeenCalledWith(planId)
})
it("refreshes plans after a matching cancellation receipt even without Realtime", async () => {
  const refreshPlans = jest.fn().mockResolvedValue(undefined)
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => receipt } as Response)
  const { result } = renderHook(() => usePlanRunActions({ id: instanceId }, refreshPlans))
  await act(async () => { await result.current.cancelPlan(planId) })
  expect(refreshPlans).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it("keeps refresh failure separate from cancellation failure and never replays", async () => {
  const refreshPlans = jest.fn().mockRejectedValue(new Error("read unavailable"))
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => receipt } as Response)
  const { result } = renderHook(() => usePlanRunActions({ id: instanceId }, refreshPlans))
  await act(async () => { await result.current.cancelPlan(planId) })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(toast.mock.calls.every(([value]) => value.title === "Plan cancelled")).toBe(true)
})
it("reports unsuccessful plan refresh without claiming the mutation failed", async () => {
  const refreshPlans = jest.fn().mockResolvedValue(false)
  jest.mocked(fetch).mockResolvedValue({ ok: true,json: async () => receipt } as Response)
  const { result } = renderHook(() => usePlanRunActions({ id: instanceId },refreshPlans))
  await act(async () => { await result.current.cancelPlan(planId) })
  expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Plan cancelled",description: "Refresh the instance to load the updated plans." }))
  expect(fetch).toHaveBeenCalledTimes(1)
})