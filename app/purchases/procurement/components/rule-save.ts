import type { PolicyDocument } from '../domain';

/** Persist only the selected rule against the confirmed revision, never sibling drafts. */
export function ruleSaveDocument(saved: PolicyDocument, draft: PolicyDocument, ruleId: string): PolicyDocument | null {
  const rule = draft.rules.find(item => item.id === ruleId);
  if (!rule) return null;
  return { ...saved, rules: saved.rules.some(item => item.id === ruleId)
    ? saved.rules.map(item => item.id === ruleId ? rule : item) : [...saved.rules, rule] };
}

/** Keep unsaved siblings/settings while accepting server-owned versions for the saved rule. */
export function mergeRuleSave(draft: PolicyDocument, confirmed: PolicyDocument, ruleId: string): PolicyDocument {
  return { ...draft, rules: draft.rules.map(item => item.id === ruleId
    ? confirmed.rules.find(rule => rule.id === ruleId) ?? item : item) };
}