import { z } from 'zod'
import { accountingDate } from './dates'
import { COMMON_CURRENCIES } from '@/app/lib/currencies'

export const accountTypeSchema = z.enum(['asset', 'liability', 'equity', 'income', 'expense'])
const currencies = typeof Intl.supportedValuesOf === 'function'
  ? Intl.supportedValuesOf('currency') : COMMON_CURRENCIES.map(({ code }) => code)
export const currencySchema = z.string().trim().toUpperCase().refine(value => currencies.includes(value), 'Invalid currency')
export const accountCodeSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/, 'Invalid account code')
export const amountSchema = z.number().finite().min(0).max(1_000_000_000_000)
  .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001, 'Use at most two decimal places')

export const journalLineSchema = z.object({
  accountCode: accountCodeSchema,
  debit: amountSchema,
  credit: amountSchema,
}).refine(line => (line.debit > 0) !== (line.credit > 0), 'Each line must have either a debit or a credit')

export const journalPayloadSchema = z.object({
  entryDate: z.string().transform(accountingDate),
  memo: z.string().trim().max(2000),
  currency: currencySchema,
  lines: z.array(journalLineSchema).min(2).max(500),
  expectedHash: z.string().max(10000).nullable().optional(),
}).superRefine((payload, ctx) => {
  const debits = payload.lines.reduce((sum, line) => sum + Math.round(line.debit * 100), 0)
  const credits = payload.lines.reduce((sum, line) => sum + Math.round(line.credit * 100), 0)
  if (!Number.isSafeInteger(debits) || debits <= 0 || debits !== credits) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Journal debits must equal credits exactly' })
  }
})

export type JournalPayload = z.input<typeof journalPayloadSchema>

export function parseJournalPayload(payload: unknown) {
  const result = journalPayloadSchema.safeParse(payload)
  if (!result.success) throw new Error(result.error.issues[0]?.message || 'Invalid journal entry')
  return result.data
}