import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { DeleteRobotModal } from "@/app/components/robots/DeleteRobotModal"
import { deleteRobotInstance } from "@/app/robots/delete-robot-instance"
import { useToast } from "@/app/components/ui/use-toast"

jest.mock("@/app/robots/delete-robot-instance", () => ({ deleteRobotInstance: jest.fn() }))
jest.mock("@/app/components/ui/use-toast", () => ({ useToast: jest.fn() }))

const instanceId = "00000000-0000-4000-8000-000000000001"
const toast = jest.fn()
const refresh = jest.fn()

function renderModal() {
  const handlers = {
    onOpenChange: jest.fn(), onDeleteStart: jest.fn(), onDeleteSuccess: jest.fn(), onDeleteError: jest.fn(),
  }
  render(<DeleteRobotModal open instanceId={instanceId} instanceName="Test agent" {...handlers} />)
  return handlers
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useToast).mockReturnValue({ toast } as unknown as ReturnType<typeof useToast>)
  jest.mocked(useRouter).mockReturnValue({ refresh } as unknown as ReturnType<typeof useRouter>)
  jest.mocked(deleteRobotInstance).mockResolvedValue({ success: true, instance_id: instanceId, deleted_requirement_ids: [] })
})

it("explicitly warns that requirements and their history will be removed", async () => {
  const handlers = renderModal()
  expect(screen.getByText(/its associated requirements/)).toHaveTextContent("requirement history")
  fireEvent.click(screen.getByRole("button", { name: "Delete" }))
  await waitFor(() => expect(handlers.onDeleteSuccess).toHaveBeenCalledTimes(1))
  expect(deleteRobotInstance).toHaveBeenCalledWith(instanceId)
  expect(handlers.onDeleteStart).toHaveBeenCalledWith(instanceId)
  expect(handlers.onOpenChange).toHaveBeenCalledWith(false)
  expect(refresh).toHaveBeenCalledTimes(1)
})

it("restores the deleting state and keeps confirmation open on a failed deletion", async () => {
  jest.mocked(deleteRobotInstance).mockRejectedValueOnce(new Error("Linked requirement belongs to another instance."))
  const handlers = renderModal()
  fireEvent.click(screen.getByRole("button", { name: "Delete" }))
  await waitFor(() => expect(handlers.onDeleteError).toHaveBeenCalledWith(instanceId))
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({
    variant: "destructive", description: "Linked requirement belongs to another instance.",
  }))
  expect(handlers.onDeleteSuccess).not.toHaveBeenCalled()
  expect(handlers.onOpenChange).not.toHaveBeenCalled()
  expect(refresh).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled()
})