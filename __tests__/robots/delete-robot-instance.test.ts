/** @jest-environment node */
import { deleteRobotInstance } from "@/app/robots/delete-robot-instance"

const instanceId = "00000000-0000-4000-8000-000000000001"
const requirementId = "00000000-0000-4000-8000-000000000002"
const result = { success: true, instance_id: instanceId, deleted_requirement_ids: [requirementId] }

beforeEach(() => jest.mocked(fetch).mockReset())

it("uses the same-origin route and explicitly confirms requirement deletion", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(result))
  await expect(deleteRobotInstance(instanceId)).resolves.toEqual(result)
  expect(fetch).toHaveBeenCalledWith("/api/robots/instance/delete", expect.objectContaining({
    method: "POST", credentials: "same-origin", redirect: "error",
    body: JSON.stringify({ instance_id: instanceId, delete_requirements: true }),
  }))
})

it.each([{}, { ...result, success: false }, { ...result, instance_id: requirementId }])(
  "requires a matching successful deletion receipt", async body => {
    jest.mocked(fetch).mockResolvedValueOnce(Response.json(body))
    await expect(deleteRobotInstance(instanceId)).rejects.toThrow("Deletion could not be confirmed")
  },
)

it("surfaces sanitized server errors and never retries uncertain results", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: { message: "Shared requirement" } }, { status: 409 }))
  await expect(deleteRobotInstance(instanceId)).rejects.toThrow("Shared requirement")
  expect(fetch).toHaveBeenCalledTimes(1)
  jest.mocked(fetch).mockRejectedValueOnce(new Error("network private detail"))
  await expect(deleteRobotInstance(instanceId)).rejects.toThrow("Deletion could not be confirmed")
  expect(fetch).toHaveBeenCalledTimes(2)
})