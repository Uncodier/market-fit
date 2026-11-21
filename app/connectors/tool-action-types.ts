import { z } from "zod"

export const toolActionTypes = ["read", "create", "update", "delete"] as const
export const toolActions = ["all", ...toolActionTypes, "unclassified"] as const
export const toolActionFilterSchema = z.enum([...toolActionTypes, "unclassified"])
export const toolActionTypesSchema = z.array(z.enum(toolActionTypes)).max(toolActionTypes.length)

export type ToolAction = typeof toolActions[number]
export type ToolActionType = typeof toolActionTypes[number]

const groupPriority = [...toolActionTypes].reverse()
export function primaryToolAction(types: ToolActionType[] = []) {
  return groupPriority.find(type => types.includes(type)) ?? "unclassified"
}