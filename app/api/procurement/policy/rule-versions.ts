import type { PolicyDocument } from "@/app/purchases/procurement/domain"

/** Versions are assigned by the server; policy snapshot revision remains the CAS key. */
export function assignRuleVersions(document: PolicyDocument, previous: PolicyDocument | null): PolicyDocument {
  const existing = new Map(previous?.rules.map(rule => [rule.id, rule]) ?? [])
  return { ...document, rules: document.rules.map(rule => {
    const old = existing.get(rule.id)
    if (!old) return { ...rule, version: 1 }
    const unchanged = JSON.stringify({ ...rule, version: 0 }) === JSON.stringify({ ...old, version: 0 })
    return { ...rule, version: unchanged ? old.version : old.version + 1 }
  }) }
}