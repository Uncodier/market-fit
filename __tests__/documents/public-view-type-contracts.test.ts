/** @jest-environment node */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { mapDocumentLineItems } from "@/app/documents/map-document-items"

describe("public document view contracts", () => {
  it.each(["app/i/[token]/page.tsx", "app/so/[token]/page.tsx"])(
    "%s uses public branding instead of private tenant columns", relativePath => {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8")
      expect(source).not.toMatch(/\b(?:sale|order)\.(?:site_id|owner_site_id)\b/)
      expect(source).toContain("branding?.site?.id")
      expect(source).toContain("useState<PublicDocumentViewProps | null>")
    },
  )

  it("maps vendor bill unit costs without changing totals", () => {
    expect(mapDocumentLineItems([
      { name: "Materials", quantity: 2, unitCost: 15, subtotal: 30 },
      { name: "", quantity: 0, unitCost: 0, subtotal: 0 },
    ])).toEqual([
      { name: "Materials", quantity: 2, unit_price: 15, subtotal: 30, status: null },
      { name: "Item", quantity: 0, unit_price: 0, subtotal: 0, status: null },
    ])
  })
})