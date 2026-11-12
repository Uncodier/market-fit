import { z } from "zod"

export const capabilityIds = ["text", "tools", "structured", "vision", "summary", "embedding", "image", "speech", "transcription", "video"] as const
export const capabilityIdSchema = z.enum(capabilityIds)
export const capabilitySchema = z.object({
  mode: z.enum(["manual", "automatic", "disabled"]),
  modelId: z.string().max(300).nullable(),
  status: z.enum(["available", "unverified", "unavailable", "disabled"]),
  reason: z.string().max(2000),
  recommendation: z.object({ modelId: z.string().max(300), reason: z.string().max(800), fingerprint: z.string().length(64), createdAt: z.string(), vendorModels: z.record(z.string().max(300)) }).optional(),
  verification: z.object({ modelId: z.string().max(300), credentialVersion: z.number().int(), adapterVersion: z.string().max(100), expiresAt: z.string(), operationId: z.string().uuid(), artifactId: z.string().max(300), providerTag: z.string().max(100) }).optional(),
  embeddingDimensions: z.number().int().positive().optional(),
})
export const connectionResponseSchema = z.object({
  connection: z.object({
    id: z.string().uuid(), siteId: z.string().uuid(),
    status: z.enum(["connected", "disconnected"]), selected: z.boolean(),
    revision: z.number().int().nonnegative(), policyVersion: z.number().int().nonnegative(),
    credentialVersion: z.number().int().nonnegative(),
    capabilities: z.record(capabilityIdSchema, capabilitySchema),
    catalogUpdatedAt: z.string().nullable(), verifiedAt: z.string().nullable(), updatedAt: z.string(),
  }).nullable(),
  canManage: z.boolean(), rolloutEnabled: z.boolean(),
  selectionMode: z.enum(["manual", "automatic-or-manual"]), paidSelectionEnabled: z.boolean(),
})
export const modelsResponseSchema = z.object({
  models: z.array(z.object({
    id: z.string().min(1).max(300), name: z.string().max(500),
    inputModalities: z.array(z.string().max(80)), outputModalities: z.array(z.string().max(80)),
    supportedParameters: z.array(z.string().max(100)), contextLength: z.number().nullable(),
    pricing: z.record(z.number().finite().nonnegative()).optional(), endpoints: z.array(z.string().max(120)).optional(),
    maxCompletionTokens: z.number().nullable().optional(),
  })).max(10000),
  catalogUpdatedAt: z.string().nullable(),
})
export type OpenRouterConnectionResponse = z.infer<typeof connectionResponseSchema>
export type OpenRouterModelsResponse = z.infer<typeof modelsResponseSchema>
export type OpenRouterCapability = typeof capabilityIds[number]
export const setupResponseSchema = z.object({ runs: z.array(z.object({ operationId: z.string().uuid(), kind: z.enum(["recommend", "verify"]),
  state: z.enum(["dispatched", "completed", "uncertain", "failed"]), maxCostUsd: z.number(), gatewayCost: z.number().nullable(),
  createdAt: z.string(), finishedAt: z.string().nullable(), platformCharge: z.literal(0) })).max(20) })

const base = { siteId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() }
export const mutationSchema = z.discriminatedUnion("operation", [
  z.object({ ...base, operation: z.literal("connect"), apiKey: z.string().trim().min(16).max(512), consent: z.literal(true) }).strict(),
  z.object({ ...base, operation: z.literal("refresh") }).strict(),
  z.object({ ...base, operation: z.literal("disconnect") }).strict(),
  z.object({ ...base, operation: z.literal("configure"), selected: z.boolean().optional(), consent: z.literal(true).optional(),
    capabilities: z.record(capabilityIdSchema, z.object({
      mode: z.enum(["automatic", "manual", "disabled"]), modelId: z.string().max(300).nullable().optional(), embeddingDimensions: z.number().int().min(1).max(65536).optional(),
    }).strict()).optional(),
  }).strict(),
  z.object({ ...base, operation: z.literal("recommend"), operationId: z.string().uuid(), consent: z.literal(true), maxCostUsd: z.number().min(0.001).max(1),
    preferredVendor: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(80).optional(), maxPromptPrice: z.number().min(0).max(100), maxCompletionPrice: z.number().min(0).max(500) }).strict(),
  z.object({ ...base, operation: z.literal("verify"), operationId: z.string().uuid(), consent: z.literal(true), capability: z.literal("image"), modelId: z.string().max(200), maxCostUsd: z.number().min(0.001).max(1) }).strict(),
  z.object({ ...base, operation:z.literal("recover_verification"),operationId:z.string().uuid() }).strict(),
])