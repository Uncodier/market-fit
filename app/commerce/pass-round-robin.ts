export type RedeemAssignmentMode = "user_choice" | "round_robin"

export type RoundRobinPassFields = {
  kind?: string | null
  digital_subtype?: string | null
  redeem_assignment_mode?: RedeemAssignmentMode | string | null
}

export function isRoundRobinPass(item: RoundRobinPassFields | null | undefined): boolean {
  return Boolean(item && item.redeem_assignment_mode === "round_robin")
}

export function isRoundRobinPassOrParent(
  item: RoundRobinPassFields | null | undefined,
  parent?: RoundRobinPassFields | null
): boolean {
  return isRoundRobinPass(item) || isRoundRobinPass(parent)
}

export type SlotAvailability = {
  start: string
  end: string
  available: number
  timezone?: string
}

/** Merge member slots by start/end. Uses max availability because one booking maps to one member. */
export function mergeMemberSlots(lists: SlotAvailability[][]): SlotAvailability[] {
  const map = new Map<string, SlotAvailability>()
  for (const list of lists) {
    for (const slot of list) {
      const key = `${slot.start}|${slot.end}`
      const existing = map.get(key)
      if (existing) {
        existing.available += slot.available // sum availability from all members
        if (!existing.timezone && slot.timezone) existing.timezone = slot.timezone
      } else {
        map.set(key, {
          start: slot.start,
          end: slot.end,
          available: slot.available,
          timezone: slot.timezone,
        })
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  )
}

/**
 * Fair cycle: start at nextIndex, pick the first available member, then advance
 * the cursor past them. Skips unavailable members; wraps after a full cycle.
 */
export function pickNextRedeemableMember(params: {
  orderedMemberIds: string[]
  nextIndex: number
  availableMemberIds: string[]
}): { memberId: string; nextIndex: number } | null {
  const { orderedMemberIds, availableMemberIds } = params
  if (orderedMemberIds.length === 0) return null

  const available = new Set(availableMemberIds)
  const len = orderedMemberIds.length
  const start = ((params.nextIndex % len) + len) % len

  for (let i = 0; i < len; i++) {
    const idx = (start + i) % len
    const memberId = orderedMemberIds[idx]
    if (available.has(memberId)) {
      return { memberId, nextIndex: (idx + 1) % len }
    }
  }

  return null
}
