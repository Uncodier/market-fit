import React from "react"
import type { AccountingAccount } from "@/app/types"

export const mockSite = { current: { id: "site-a", settings: { currency: "USD" } } }

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite.current }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "", locale: "en" }) }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => null }))
jest.mock("@/app/components/ui/use-btn-glass-motion", () => ({ useBtnGlassMotion: () => () => undefined }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => false }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header> }))
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }))

export function account(code: string, label: string, overrides: Partial<AccountingAccount> = {}): AccountingAccount {
  return { id: `account-${code}`, siteId: "site-a", code, label, key: `KEY_${code}`, type: "asset", system: false, active: true, createdAt: "", updatedAt: "", ...overrides }
}

export const accounts = [
  account("1000", "Cash"),
  account("2000", "Payables", { type: "liability" }),
  account("3000", "Retained Earnings", { type: "equity", system: true }),
  account("6100", "Legacy Expense", { type: "expense", active: false }),
]

export function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-a", site_id: "site-a", entry_date: "2026-09-01T00:00:00+00:00", memo: "Opening adjustment", currency: "EUR", source_type: "manual", source_hash: "loaded-hash",
    journal_lines: [
      { id: "line-a", account_code: "1000", debit: 10, credit: 0 },
      { id: "line-b", account_code: "2000", debit: 0, credit: 10 },
    ],
    ...overrides,
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeAll(() => {
  Object.defineProperty(global.crypto, "randomUUID", { configurable: true, value: () => require("crypto").randomUUID() })
  Element.prototype.scrollIntoView = jest.fn()
  Element.prototype.hasPointerCapture = jest.fn(() => false)
  Element.prototype.setPointerCapture = jest.fn()
  Element.prototype.releasePointerCapture = jest.fn()
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

beforeEach(() => {
  mockSite.current = { id: "site-a", settings: { currency: "USD" } }
  jest.clearAllMocks()
})