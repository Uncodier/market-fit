import type { AccountingAccount } from "@/app/types"
import { parseJournalPayload } from "../validation"

export type AmountInput = number | string
export type JournalDraftLine = { id: string; accountCode: string; debit: AmountInput; credit: AmountInput }
export type OpeningBalances = Record<string, { debit: AmountInput; credit: AmountInput }>

export function nonzeroLines<T extends { debit: AmountInput; credit: AmountInput }>(lines: T[]): T[] {
  return lines.filter((line) => amountCents(line.debit) !== 0 || amountCents(line.credit) !== 0)
}

// Parse decimal input exactly: never round fractional cents into a valid entry.
export function amountCents(value: AmountInput): number | null {
  const text = String(value).trim() || "0"
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null
  const [whole, fraction = ""] = text.split(".")
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  return Number.isSafeInteger(cents) ? cents : null
}

export function validEntryDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function journalTotals(lines: Pick<JournalDraftLine, "debit" | "credit">[]) {
  let debit = 0
  let credit = 0
  let valid = true
  for (const line of lines) {
    const d = amountCents(line.debit)
    const c = amountCents(line.credit)
    if (d === null || c === null || (d > 0) === (c > 0)) valid = false
    debit += d ?? 0
    credit += c ?? 0
  }
  valid &&= Number.isSafeInteger(debit) && Number.isSafeInteger(credit)
  return { debit, credit, valid, balanced: debit > 0 && debit === credit }
}

export function validateJournalDraft(
  date: string, memo: string, currency: string, lines: JournalDraftLine[],
  accounts: AccountingAccount[], existingLines: JournalDraftLine[] = [],
): string | null {
  if (!validEntryDate(date)) return "Choose a valid entry date."
  if (!memo.trim()) return "Enter a memo."
  if (!/^[A-Z]{3}$/.test(currency)) return "A valid currency is required."
  if (lines.length < 2) return "At least two lines are required."
  for (const line of lines) {
    const account = accounts.find((candidate) => candidate.code === line.accountCode)
    const existing = existingLines.some((original) => original.id === line.id && original.accountCode === line.accountCode)
    if (!account || (!account.active && !existing)) return "Select an active account for each new line."
  }
  const totals = journalTotals(lines)
  if (!totals.valid) return "Each line needs a positive debit or credit with no fractional cents."
  if (!totals.balanced) return "Positive total debits must equal total credits."
  try {
    parseJournalPayload({ entryDate: date, memo, currency, lines: lines.map((line) => ({ ...line, debit: Number(line.debit), credit: Number(line.credit) })) })
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid journal entry."
  }
  return null
}

export function openingDraft(balances: OpeningBalances) {
  const lines = Object.entries(balances).filter(([code]) => code !== "3000")
    .map(([accountCode, amounts]) => ({ id: accountCode, accountCode, ...amounts }))
    .filter((line) => amountCents(line.debit) !== 0 || amountCents(line.credit) !== 0)
  const totals = journalTotals(lines)
  const debit = Math.max(0, totals.credit - totals.debit) / 100
  const credit = Math.max(0, totals.debit - totals.credit) / 100
  const equity = { debit, credit }
  if (debit > 0 || credit > 0) lines.push({ id: "3000", accountCode: "3000", ...equity })
  return { lines, equity, totals: journalTotals(lines) }
}