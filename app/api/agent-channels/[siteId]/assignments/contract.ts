import { z } from "zod"

export const uuid = z.string().uuid()
export const connectionId = z.string().min(1).max(200).refine(id =>
  id === id.trim() && !Array.from(id).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
export const assignment = z.object({
  connectionId, agentId: uuid.nullable(), revision: z.number().int().positive(),
})
export const patch = z.object({
  connectionId, agentId: uuid.transform(id => id.toLowerCase()).nullable(),
  expectedRevision: z.number().int().min(0).max(2147483646),
}).strict()

export class AssignmentError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

export function readError(error: { code?: string }): AssignmentError {
  return error.code === "42501" ? new AssignmentError(403, "Forbidden")
    : new AssignmentError(503, "Channel assignments could not be loaded")
}

export function patchError(error: { code?: string }) {
  switch (error.code) {
    case "42501": return new AssignmentError(403, "Forbidden")
    case "22023": return new AssignmentError(400, "Invalid assignment request")
    case "PT404": return new AssignmentError(404, "Connection is missing or ambiguous")
    case "PT409": return new AssignmentError(409, "Assignment changed. Refresh before saving again.")
    case "PT422": return new AssignmentError(422, "Select an available agent from this site")
    default: return new AssignmentError(503, "Channel assignment could not be saved")
  }
}

export function missingAssignmentTable(error: { code?: string; message?: string }) {
  return (error.code === "PGRST205" &&
    error.message === "Could not find the table 'public.channel_agent_assignments' in the schema cache") ||
    (error.code === "42P01" && /^relation "(?:public\.)?channel_agent_assignments" does not exist$/.test(error.message ?? ""))
}