import {
  isRoundRobinPass,
  mergeMemberSlots,
  pickNextRedeemableMember,
} from "@/app/commerce/pass-round-robin"
import { isAccessOnlyItem, getListingCtaLabel } from "@/app/catalog/product-details"
import type { CatalogItem } from "@/app/types"

describe("pass round-robin picker", () => {
  it("cycles A → B → C → A without repeating until the loop completes", () => {
    const members = ["A", "B", "C"]
    const first = pickNextRedeemableMember({
      orderedMemberIds: members,
      nextIndex: 0,
      availableMemberIds: members,
    })
    expect(first).toEqual({ memberId: "A", nextIndex: 1 })

    const second = pickNextRedeemableMember({
      orderedMemberIds: members,
      nextIndex: first!.nextIndex,
      availableMemberIds: members,
    })
    expect(second).toEqual({ memberId: "B", nextIndex: 2 })

    const third = pickNextRedeemableMember({
      orderedMemberIds: members,
      nextIndex: second!.nextIndex,
      availableMemberIds: members,
    })
    expect(third).toEqual({ memberId: "C", nextIndex: 0 })

    const wrap = pickNextRedeemableMember({
      orderedMemberIds: members,
      nextIndex: third!.nextIndex,
      availableMemberIds: members,
    })
    expect(wrap).toEqual({ memberId: "A", nextIndex: 1 })
  })

  it("skips unavailable members and still advances past the assigned one", () => {
    const picked = pickNextRedeemableMember({
      orderedMemberIds: ["A", "B", "C"],
      nextIndex: 1,
      availableMemberIds: ["A", "C"],
    })
    expect(picked).toEqual({ memberId: "C", nextIndex: 0 })
  })

  it("reuses the only available member when the rest of the cycle is busy", () => {
    const first = pickNextRedeemableMember({
      orderedMemberIds: ["A", "B", "C"],
      nextIndex: 0,
      availableMemberIds: ["B"],
    })
    expect(first).toEqual({ memberId: "B", nextIndex: 2 })

    const second = pickNextRedeemableMember({
      orderedMemberIds: ["A", "B", "C"],
      nextIndex: first!.nextIndex,
      availableMemberIds: ["B"],
    })
    expect(second).toEqual({ memberId: "B", nextIndex: 2 })
  })

  it("returns null when no members can take the slot", () => {
    expect(
      pickNextRedeemableMember({
        orderedMemberIds: ["A", "B"],
        nextIndex: 0,
        availableMemberIds: [],
      })
    ).toBeNull()
  })

  it("returns null for an empty member list", () => {
    expect(
      pickNextRedeemableMember({
        orderedMemberIds: [],
        nextIndex: 0,
        availableMemberIds: ["A"],
      })
    ).toBeNull()
  })

  it("normalizes a negative cursor into the cycle", () => {
    const picked = pickNextRedeemableMember({
      orderedMemberIds: ["A", "B", "C"],
      nextIndex: -1,
      availableMemberIds: ["A", "B", "C"],
    })
    expect(picked?.memberId).toBe("C")
  })
})

describe("mergeMemberSlots", () => {
  it("unions start/end and sums availability", () => {
    const merged = mergeMemberSlots([
      [{ start: "t1", end: "t2", available: 1 }],
      [
        { start: "t1", end: "t2", available: 3 },
        { start: "t3", end: "t4", available: 1 },
      ],
    ])
    expect(merged).toEqual([
      { start: "t1", end: "t2", available: 4 },
      { start: "t3", end: "t4", available: 1 },
    ])
  })
})

describe("isRoundRobinPass / access-only", () => {
  const userChoicePass = {
    kind: "digital_asset",
    digital_subtype: "pass",
    redeem_assignment_mode: "user_choice",
    is_recurring: false,
  } as CatalogItem

  const roundRobinPass = {
    kind: "digital_asset",
    digital_subtype: "pass",
    redeem_assignment_mode: "round_robin",
    is_reservation: true,
    is_recurring: false,
  } as CatalogItem

  it("treats user_choice passes as access-only (buyer picks later)", () => {
    expect(isRoundRobinPass(userChoicePass)).toBe(false)
    expect(isAccessOnlyItem(userChoicePass)).toBe(true)
    expect(getListingCtaLabel(userChoicePass)).toBe("marketplace.listing.cta.buyPass")
  })

  it("treats round_robin passes as drop-in in Shop / POS / Marketplace", () => {
    expect(isRoundRobinPass(roundRobinPass)).toBe(true)
    expect(isAccessOnlyItem(roundRobinPass)).toBe(false)
    expect(getListingCtaLabel(roundRobinPass)).toBe("marketplace.listing.cta.book")
  })

  it("keeps subscriptions access-only even if marked round_robin", () => {
    const recurring = {
      ...roundRobinPass,
      is_recurring: true,
    } as CatalogItem
    expect(isAccessOnlyItem(recurring)).toBe(true)
    expect(getListingCtaLabel(recurring)).toBe("marketplace.listing.cta.subscribe")
  })
})

describe("team member booking calendars stay separate", () => {
  it("does not import pass round-robin from /book calendar actions", () => {
    const fs = require("fs") as typeof import("fs")
    const path = require("path") as typeof import("path")
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/book/actions.ts"),
      "utf8"
    )
    expect(src).not.toMatch(/pass-round-robin/)
    expect(src).toMatch(/RoundRobinCalendar/)
  })

  it("keeps buyer service select on entitlement PassBookingPanel", () => {
    const fs = require("fs") as typeof import("fs")
    const path = require("path") as typeof import("path")
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/components/commerce/pdp/PassBookingPanel.tsx"),
      "utf8"
    )
    expect(src).toMatch(/selectedServiceId/)
    expect(src).toMatch(/Choose a service/)
  })
})
