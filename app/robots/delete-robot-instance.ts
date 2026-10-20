import { z } from "zod"

const resultSchema = z.object({
  success: z.literal(true),
  instance_id: z.string().uuid(),
  deleted_requirement_ids: z.array(z.string().uuid()),
})
const unconfirmed = "Deletion could not be confirmed. Refresh the instance list before trying again."

export class RobotDeletionError extends Error {
  constructor(message: string, public readonly status: number) { super(message) }
}

export async function deleteRobotInstance(instanceId: string) {
  let response: Response
  try {
    response = await fetch("/api/robots/instance/delete", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instance_id: instanceId, delete_requirements: true }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(600_000),
    })
  } catch {
    throw new Error(unconfirmed)
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new RobotDeletionError(typeof payload?.error?.message === "string" ? payload.error.message : unconfirmed, response.status)
  }
  const result = resultSchema.safeParse(payload)
  if (!result.success || result.data.instance_id !== instanceId) throw new Error(unconfirmed)
  return result.data
}