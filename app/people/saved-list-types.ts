import { z } from 'zod'
import type { FinderRequest } from './finder-request-types'

const nullableText = z.string().nullable()
export const savedPersonResultSchema = z.object({
  person: z.object({
    id: z.string(), full_name: z.string(), photo: nullableText, location: nullableText,
    headline: nullableText, description: nullableText,
    linkedin_info: z.object({ public_profile_url: nullableText }),
  }),
  organization: z.object({
    id: nullableText, name: nullableText, logo: nullableText, description: nullableText,
    employee_count: z.number().nullable(), revenue: z.number().nullable(), founded_date: nullableText,
    industries: z.array(z.string()), website: nullableText,
    linkedin_info: z.object({ public_profile_url: nullableText }),
  }),
  role_title: nullableText, role_description: nullableText,
  start_date: nullableText, end_date: nullableText, is_current: z.boolean(),
})
export const savedListMemberSchema = z.object({
  personId: z.string(), processing: z.enum(['pending', 'completed']),
  outcome: z.enum(['matched', 'no_match', 'needs_review']).nullable(),
  lead: z.object({ id: z.string().uuid(), name: z.string().nullable() }).nullable(),
  result: savedPersonResultSchema,
})
export const savedListSnapshotSchema = z.object({
  id: z.string().uuid(), siteId: z.string().uuid(), name: z.string(), status: z.string(),
  members: z.array(savedListMemberSchema).max(25), total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.literal(25),
})
export type SavedListMember = z.infer<typeof savedListMemberSchema>
export type SavedListSnapshot = z.infer<typeof savedListSnapshotSchema>
export type SavedPersonResult = z.infer<typeof savedPersonResultSchema>
export type SavedListReference = { id: string; siteId: string; query?: FinderRequest }
export const SAVED_LIST_PAGE_SIZE = 25