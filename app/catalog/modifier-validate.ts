import type { ModifierGroupWithItems, ModifierSelection } from "./modifier-types"

export type ModifierValidationResult =
  | { ok: true }
  | { ok: false; error: string; groupId?: string }

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
      return { ok: false, error: "Selección de modificador inválida" }
    }
    if (!Number.isFinite(sel.quantity) || sel.quantity < 1) {
      return {
        ok: false,
        error: "La cantidad del modificador debe ser al menos 1",
        groupId: sel.groupId,
      }
    }
    const allowed = allowedByGroup.get(sel.groupId)
    if (!allowed) {
      return {
        ok: false,
        error: "Grupo de modificador desconocido",
        groupId: sel.groupId,
      }
    }
    if (!allowed.has(sel.catalogItemId)) {
      return {
        ok: false,
        error: "El modificador no pertenece a este grupo",
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
        error: `Selecciona al menos ${group.min_select} de ${group.name}`,
        groupId: group.id,
      }
    }
    if (group.max_select != null && totalUnits > group.max_select) {
      return {
        ok: false,
        error: `Selecciona como máximo ${group.max_select} de ${group.name}`,
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
