import type { ModifierGroupWithItems, ModifierSelection } from "./modifier-types"

export type ModifierValidationResult =
  | { ok: true }
  | {
      ok: false
      error: string
      errorKey: string
      errorParams?: Record<string, string | number>
      groupId?: string
    }

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string

export function getModifierValidationError(
  result: Extract<ModifierValidationResult, { ok: false }>,
  t: Translate,
): string {
  return t(result.errorKey, result.errorParams) || result.error
}

/**
 * Validate modifier selections against group min/max and allowed option ids.
 * Selection quantity is per option (≥1). Total selected units per group =
 * sum of quantities for options in that group.
 */
export function validateModifierSelections(
  groups: ModifierGroupWithItems[],
  selections: ModifierSelection[],
): ModifierValidationResult {
  const allowedByGroup = new Map<string, Set<string>>()
  for (const group of groups) {
    allowedByGroup.set(
      group.id,
      new Set(group.items.map((i) => i.catalog_item_id)),
    )
  }

  for (const sel of selections) {
    if (!sel.catalogItemId || !sel.groupId) {
      return {
        ok: false,
        error: "Invalid modifier selection",
        errorKey: "pos.modifiers.errors.invalidSelection",
      }
    }
    if (!Number.isFinite(sel.quantity) || sel.quantity < 1) {
      return {
        ok: false,
        error: "Modifier quantity must be at least 1",
        errorKey: "pos.modifiers.errors.invalidQuantity",
        groupId: sel.groupId,
      }
    }
    const allowed = allowedByGroup.get(sel.groupId)
    if (!allowed) {
      return {
        ok: false,
        error: "Unknown modifier group",
        errorKey: "pos.modifiers.errors.unknownGroup",
        groupId: sel.groupId,
      }
    }
    if (!allowed.has(sel.catalogItemId)) {
      return {
        ok: false,
        error: "Modifier does not belong to this group",
        errorKey: "pos.modifiers.errors.invalidGroupItem",
        groupId: sel.groupId,
      }
    }
  }

  for (const group of groups) {
    const groupSels = selections.filter((s) => s.groupId === group.id)
    const totalUnits = groupSels.reduce((sum, s) => sum + s.quantity, 0)

    if (totalUnits < (group.min_select ?? 0)) {
      return {
        ok: false,
        error: `Select at least ${group.min_select} from ${group.name}`,
        errorKey: "pos.modifiers.errors.selectAtLeast",
        errorParams: {
          count: group.min_select ?? 0,
          group: group.name,
        },
        groupId: group.id,
      }
    }
    if (group.max_select != null && totalUnits > group.max_select) {
      return {
        ok: false,
        error: `Select at most ${group.max_select} from ${group.name}`,
        errorKey: "pos.modifiers.errors.selectAtMost",
        errorParams: {
          count: group.max_select,
          group: group.name,
        },
        groupId: group.id,
      }
    }
  }

  return { ok: true }
}

/** Stable signature for cart merge / line identity (host + sorted modifiers). */
export function buildModifierSignature(
  hostCatalogItemId: string,
  modifiers: Array<{ catalogItemId: string; quantity: number }>,
): string {
  const parts = [...modifiers]
    .map((m) => `${m.catalogItemId}:${m.quantity}`)
    .sort()
  return `${hostCatalogItemId}|${parts.join(",")}`
}
