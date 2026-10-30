import { defaultPolicyDocument, procurementRuleSchema } from '@/app/purchases/procurement/domain';
import { mergeRuleSave, ruleSaveDocument } from '@/app/purchases/procurement/components/rule-save';

test('saving one rule excludes sibling drafts and unsaved settings and preserves them after confirmation', () => {
  const saved = defaultPolicyDocument();
  saved.rules = ['a', 'b'].map(id => procurementRuleSchema.parse({ id, name: id, type: 'approval', event: 'requisition' }));
  const draft = { ...saved, settings: { ...saved.settings, timeZone: 'Asia/Tokyo' }, rules: saved.rules.map(rule => ({ ...rule, name: `Edited ${rule.id}` })) };
  const request = ruleSaveDocument(saved, draft, 'a')!;
  expect(request.settings).toEqual(saved.settings);
  expect(request.rules.map(rule => rule.name)).toEqual(['Edited a', 'b']);
  const confirmed = { ...request, rules: request.rules.map(rule => rule.id === 'a' ? { ...rule, version: 2 } : rule) };
  const merged = mergeRuleSave(draft, confirmed, 'a');
  expect(merged.settings.timeZone).toBe('Asia/Tokyo');
  expect(merged.rules.map(rule => rule.name)).toEqual(['Edited a', 'Edited b']);
  expect(merged.rules[0].version).toBe(2);
  expect(ruleSaveDocument(saved, merged, 'b')!.rules.map(rule => rule.name)).toEqual(['a', 'Edited b']);
});

test('new rules are saved individually, not alongside other new drafts', () => {
  const saved = defaultPolicyDocument();
  const draft = { ...saved, rules: ['new-a', 'new-b'].map(id => procurementRuleSchema.parse({ id, name: id, type: 'approval', event: 'requisition' })) };
  expect(ruleSaveDocument(saved, draft, 'new-a')!.rules.map(rule => rule.id)).toEqual(['new-a']);
  expect(ruleSaveDocument(saved, draft, 'missing')).toBeNull();
});