import type { PosCartItem } from "@/app/pos/components/CartPanel"
import {
  pendingSendDeltaCount,
  sentLineQuantitiesFromSaleOrderItems,
} from "@/app/pos/send-delta"

function cartLine(
  lineKey: string,
  cartQty: number,
): PosCartItem {
  return {
    id: lineKey,
    lineKey,
    name: lineKey,
    cartQty,
    cartPrice: 1,
  } as PosCartItem
}

describe("pendingSendDeltaCount", () => {
  it("excludes unchanged quantities that were already sent", () => {
    expect(
      pendingSendDeltaCount(
        [cartLine("burger", 2), cartLine("fries", 1)],
        { burger: 2, fries: 1 },
      ),
    ).toBe(0)
  })

  it("counts new quantities and quantity changes", () => {
    expect(
      pendingSendDeltaCount(
        [cartLine("burger", 3), cartLine("fries", 2)],
        { burger: 2 },
      ),
    ).toBe(3)
  })

  it("counts decreases and removed sent lines as pending deltas", () => {
    expect(
      pendingSendDeltaCount(
        [cartLine("burger", 1)],
        { burger: 2, fries: 2 },
      ),
    ).toBe(3)
  })
})

describe("sentLineQuantitiesFromSaleOrderItems", () => {
  it("keeps only previously sent parent lines", () => {
    expect(
      sentLineQuantitiesFromSaleOrderItems([
        {
          id: "sent-id",
          quantity: 2,
          status: "new",
          metadata: { client_line_key: "burger" },
        },
        { id: "draft", quantity: 4, status: "draft" },
        {
          id: "modifier",
          quantity: 2,
          status: "new",
          parent_sale_order_item_id: "sent-id",
        },
        { id: "cancelled", quantity: 1, status: "cancelled" },
      ]),
    ).toEqual({ burger: 2 })
  })
})
