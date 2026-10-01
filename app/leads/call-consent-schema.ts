import { z } from "zod"

export const CallConsentStatusSchema = z.enum(["unknown", "granted", "revoked"])

export const CallConsentFieldsSchema = z.object({
  voice_call_consent_status: CallConsentStatusSchema,
  voice_call_consent_at: z.string().datetime({ offset: true }).nullable(),
  do_not_call: z.boolean(),
}).strict()

export const UpdateCallConsentSchema = CallConsentFieldsSchema.extend({
  id: z.string().uuid(),
  site_id: z.string().uuid(),
  confirmed: z.literal(true),
  expected: CallConsentFieldsSchema.extend({
    phone: z.string().nullable(),
    updated_at: z.string().datetime({ offset: true }),
  }).strict(),
}).strict().superRefine((data, context) => {
  if (data.voice_call_consent_status === "granted") {
    if (!data.voice_call_consent_at || Date.parse(data.voice_call_consent_at) > Date.now()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["voice_call_consent_at"],
        message: "Enter when explicit outbound-call consent was obtained, not a future date.",
      })
    }
  } else if (data.voice_call_consent_at !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["voice_call_consent_at"],
      message: "Only granted consent can have a consent date.",
    })
  }
})

export type CallConsentFields = z.infer<typeof CallConsentFieldsSchema>
export type UpdateCallConsentInput = z.infer<typeof UpdateCallConsentSchema>
export type SavedCallConsent = CallConsentFields & { id: string; updated_at: string }