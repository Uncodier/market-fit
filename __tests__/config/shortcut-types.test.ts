import { canonicalizeShortcutRecords } from "@/app/components/navigation/shortcut-normalization"
import type { ShortcutRecord } from "@/app/components/navigation/shortcut-types"

describe("sidebar shortcut normalization", () => {
  it("replaces legacy custom order-line shortcuts and removes duplicates", () => {
    const shortcuts: ShortcutRecord[] = [
      {
        id: "custom--order-lines",
        href: "/order-lines?client=site-1",
        title: "Order-lines",
        isCustom: true,
        pinned: false,
      },
      { id: "orderLines", pinned: true },
    ]

    expect(canonicalizeShortcutRecords(shortcuts)).toEqual([
      { id: "orderLines", pinned: true },
    ])
  })

  it("keeps custom deep links distinct from their parent screen", () => {
    const shortcut: ShortcutRecord = {
      id: "custom-order-detail",
      href: "/orders/order-1",
      title: "Order 1",
      isCustom: true,
      pinned: false,
    }

    expect(canonicalizeShortcutRecords([shortcut])).toEqual([shortcut])
  })
})
