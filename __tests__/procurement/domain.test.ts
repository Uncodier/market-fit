import {
  approvalStageSchema, defaultPolicyDocument, evaluateProcurementPolicy, policyDocumentSchema,
  procurementPolicySchema, procurementRuleSchema, requirementSchema, simulationInputSchema, timestampSchema, timingSchema,
} from '@/app/purchases/procurement/domain';
import type { ApprovalStage, PolicyDocument, ProcurementRule, SimulationInput, Timing } from '@/app/purchases/procurement/domain';

const now = '2026-10-27T12:00:00Z';
function stage(overrides: Partial<ApprovalStage> = {}): ApprovalStage {
  return approvalStageSchema.parse({
    id: 'finance', name: 'Finance approval', decisionMode: 'human', approverIds: ['alice', 'bob'],
    quorum: { mode: 'n_of_m', count: 2 }, rejectionBehavior: 'veto', execution: 'sequential',
    allowSelfApproval: false, timeoutAction: 'block', ...overrides,
  });
}
function rule(overrides: Partial<ProcurementRule> = {}): ProcurementRule {
  return procurementRuleSchema.parse({
    id: 'high-value', name: 'High value', type: 'approval', event: 'requisition', status: 'active',
    amount: { operator: 'gt', valueMinor: 5000000, currency: 'MXN', basis: 'document' },
    stages: [stage()], ...overrides,
  });
}
function input(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return simulationInputSchema.parse({
    event: 'requisition', currency: 'MXN', netAmountMinor: 5000001, evaluatedAt: now,
    requesterId: 'requester', ...overrides,
  });
}
function document(rules: ProcurementRule[] = []): PolicyDocument {
  const value = defaultPolicyDocument();
  value.settings.fallback = { mode: 'none' };
  value.rules = rules;
  return value;
}
const certificate = requirementSchema.parse({
  id: 'insurance', name: 'Insurance', kind: 'certification', classification: 'mandatory',
  milestone: 'award', overridable: false,
  credential: { holder: 'organization', validity: 'contract_period', evidenceRequired: true, review: 'human' },
});

describe('procurement schemas', () => {
  test('creates independent defaults and blocks unconfigured policy', () => {
    const a = defaultPolicyDocument();
    a.settings.substituteIds.push('substitute');
    expect(defaultPolicyDocument().settings.substituteIds).toEqual([]);
    expect(evaluateProcurementPolicy(defaultPolicyDocument(), input()).status).toBe('blocked');
    expect(policyDocumentSchema.safeParse(defaultPolicyDocument()).success).toBe(true);
  });

  test.each([null, {}, { version: 2, settings: {}, rules: [] }, { ...defaultPolicyDocument(), tenantId: 'forged' }])('rejects invalid document %j', (value) => {
    expect(policyDocumentSchema.safeParse(value).success).toBe(false);
    expect(evaluateProcurementPolicy(value, input())).toMatchObject({ status: 'blocked', authorized: false });
  });

  test.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '5000000'])('rejects invalid minor-unit value %s', (valueMinor) => {
    expect(procurementRuleSchema.safeParse({ ...rule(), amount: { ...rule().amount, valueMinor } }).success).toBe(false);
  });

  test('validates explicit currencies, ranges, identifiers, periods and active outcomes', () => {
    const valid = rule();
    const invalid = [
      { ...valid, amount: { ...valid.amount, currency: 'mxn' } },
      { ...valid, amount: { ...valid.amount, operator: 'between' } },
      { ...valid, amount: { ...valid.amount, operator: 'between', maxMinor: 1 } },
      { ...valid, amount: { ...valid.amount, maxMinor: 6000000 } },
      { ...valid, amount: { ...valid.amount, gross: true } },
      { ...valid, scope: { ...valid.scope, productIds: ['p', 'p'] } },
      { ...valid, effectiveFrom: now, effectiveUntil: now },
      { ...valid, stages: [] },
      { ...valid, type: 'requirements', requirements: [] },
      { ...valid, type: 'supplier_participation', minimumSupplierProposals: null },
    ];
    invalid.forEach((value) => expect(procurementRuleSchema.safeParse(value).success).toBe(false));
    expect(procurementRuleSchema.parse({ id: 'draft', name: 'Draft', type: 'approval', event: 'offer' }).status).toBe('draft');
    expect(policyDocumentSchema.safeParse(document([valid, valid])).success).toBe(false);
  });

  test('requires explicit quorum, rejection behavior and valid distinct human pools', () => {
    const valid = stage();
    [
      { ...valid, quorum: undefined }, { ...valid, rejectionBehavior: undefined },
      { ...valid, quorum: { mode: 'n_of_m', count: 3 } },
      { ...valid, approverIds: ['alice', 'alice'] }, { ...valid, approverIds: [] },
      { ...valid, mandatoryApproverIds: ['outsider'] },
      { ...valid, timeoutAction: 'approve' }, { ...valid, timeoutAction: 'escalate' },
    ].forEach((value) => expect(approvalStageSchema.safeParse(value).success).toBe(false));
    expect(stage({ quorum: { mode: 'all' }, rejectionBehavior: 'failed_vote' })).toBeDefined();
    expect(stage({ quorum: { mode: 'first_response' }, rejectionBehavior: 'return_for_correction' })).toBeDefined();
  });

  test('AI authority cannot manufacture quorum votes or replace mandatory humans', () => {
    const ai = { ...stage(), decisionMode: 'automatic_ai', approverIds: [], quorum: { mode: 'first_response' }, delegatedAgentId: 'agent' };
    expect(approvalStageSchema.safeParse(ai).success).toBe(true);
    [
      { ...ai, delegatedAgentId: null }, { ...ai, mandatoryApproverIds: ['alice'] },
      { ...ai, quorum: { mode: 'n_of_m', count: 2 } }, { ...stage(), delegatedAgentId: 'agent' },
    ].forEach((value) => expect(approvalStageSchema.safeParse(value).success).toBe(false));
  });

  test('validates certification holder/evidence and exception supervisor boundaries', () => {
    expect(requirementSchema.safeParse({ ...certificate, credential: null }).success).toBe(false);
    expect(requirementSchema.safeParse({ ...certificate, kind: 'technical' }).success).toBe(false);
    const exception = { kind: 'insufficient_offers', enabled: true, aiRecommendation: true, decisionAuthority: 'supervisor', allowedActions: ['extend'], justificationRequired: true };
    expect(procurementPolicySchema.safeParse({ exceptions: [exception] }).success).toBe(false);
    expect(procurementPolicySchema.safeParse({ supervisorId: 'supervisor', exceptions: [exception] }).success).toBe(true);
    expect(procurementPolicySchema.safeParse({ supervisorId: 'supervisor', exceptions: [{ ...exception, decisionAuthority: 'ai' }] }).success).toBe(false);
    expect(procurementPolicySchema.safeParse({ urgentPreset: { ...defaultPolicyDocument().settings.urgentPreset, preserveMandatoryRequirements: false } }).success).toBe(false);
  });
});

describe('deterministic simulation', () => {
  test.each([
    ['gt', 4999999, false], ['gt', 5000000, false], ['gt', 5000001, true],
    ['gte', 4999999, false], ['gte', 5000000, true], ['gte', 5000001, true],
    ['lt', 4999999, true], ['lt', 5000000, false], ['lte', 5000000, true],
    ['eq', 5000000, true], ['eq', 5000001, false],
  ] as const)('%s at %i net minor units matches=%s', (operator, netAmountMinor, expected) => {
    const candidate = rule({ amount: { operator, valueMinor: 5000000, currency: 'MXN', basis: 'document' } });
    const result = evaluateProcurementPolicy(document([candidate]), input({ netAmountMinor }));
    expect(result.matchedRuleIds).toEqual(expected ? [candidate.id] : []);
    expect(result.authorized).toBe(false);
  });

  test.each([[9, false], [10, true], [20, true], [21, false]])('inclusive range at %i', (netAmountMinor, expected) => {
    const candidate = rule({ amount: { operator: 'between', valueMinor: 10, maxMinor: 20, currency: 'MXN', basis: 'document' } });
    expect(evaluateProcurementPolicy(document([candidate]), input({ netAmountMinor })).matchedRuleIds.length > 0).toBe(expected);
  });

  test('uses document override then general fallback for direct purchases; matching rules cannot be erased', () => {
    const doc = document();
    doc.settings.fallback = { mode: 'approval', stages: [stage()] };
    expect(evaluateProcurementPolicy(doc, input())).toMatchObject({ source: 'general', stages: [expect.anything()] });
    expect(evaluateProcurementPolicy(doc, input({ override: { fallback: { mode: 'none' } } }))).toMatchObject({ source: 'document', stages: [] });
    doc.rules = [rule()];
    expect(evaluateProcurementPolicy(doc, input({ override: { fallback: { mode: 'none' } } }))).toMatchObject({ source: 'rules', stages: [expect.anything()] });
  });

  test('matches exact events and effective start-inclusive/end-exclusive periods', () => {
    const candidate = rule({ effectiveFrom: now, effectiveUntil: '2026-10-28T12:00:00Z' });
    expect(evaluateProcurementPolicy(document([candidate]), input()).matchedRuleIds).toHaveLength(1);
    expect(evaluateProcurementPolicy(document([candidate]), input({ evaluatedAt: candidate.effectiveUntil! })).matchedRuleIds).toHaveLength(0);
    expect(evaluateProcurementPolicy(document([candidate]), input({ event: 'offer' })).matchedRuleIds).toHaveLength(0);
    expect(evaluateProcurementPolicy(document([rule({ status: 'draft' }), rule({ id: 'archived', status: 'archived' })]), input()).matchedRuleIds).toHaveLength(0);
  });

  test('scopes product/category intersection and matching line subtotals with any/all semantics', () => {
    const candidate = rule({ scope: { productIds: ['p1'], categoryIds: ['c1'], lineMatch: 'any', requesterIds: [], responsibleIds: [] }, amount: { operator: 'gte', valueMinor: 100, currency: 'MXN', basis: 'matching_lines' } });
    const scenario = input({ netAmountMinor: 300, lines: [{ id: 'a', productId: 'p1', categoryIds: ['c1'], netAmountMinor: 100 }, { id: 'b', productId: 'p2', categoryIds: ['c1'], netAmountMinor: 200 }] });
    expect(evaluateProcurementPolicy(document([candidate]), scenario).matchedRuleIds).toHaveLength(1);
    candidate.amount!.valueMinor = 101;
    expect(evaluateProcurementPolicy(document([candidate]), scenario).matchedRuleIds).toHaveLength(0);
    candidate.amount!.valueMinor = 100;
    candidate.scope.lineMatch = 'all';
    expect(evaluateProcurementPolicy(document([candidate]), scenario).matchedRuleIds).toHaveLength(0);
  });

  test('missing classification, scope, actor or FX blocks instead of falling through to approval exemption', () => {
    const base = rule();
    [
      rule({ scope: { ...base.scope, productIds: ['p1'] } }),
      rule({ scope: { ...base.scope, responsibleIds: ['manager'] } }),
      rule({ amount: { ...base.amount!, currency: 'USD' } }),
    ].forEach((candidate) => expect(evaluateProcurementPolicy(document([candidate]), input()).status).toBe('blocked'));
    const candidate = rule({ scope: { ...base.scope, categoryIds: ['c'] } });
    expect(evaluateProcurementPolicy(document([candidate]), input({ lines: [{ id: 'a', categoryIds: [], netAmountMinor: 5000001 }] })).status).toBe('blocked');
  });

  test('accumulates named human stages and deduplicates identical evidence with version provenance', () => {
    const a = rule({ id: 'a', requirements: [certificate] });
    const b = rule({ id: 'b', version: 2, stages: [stage({ id: 'named', approverIds: ['supervisor'], mandatoryApproverIds: ['supervisor'], quorum: { mode: 'all' } })], requirements: [certificate] });
    const result = evaluateProcurementPolicy(document([b, a]), input());
    expect(result.status).toBe('ready');
    expect(result.stages).toHaveLength(2);
    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0]).toMatchObject({ sourceRuleIds: ['a', 'b'], sourceRuleVersions: [1, 2] });
    expect(result).toEqual(evaluateProcurementPolicy(document([a, b]), input()));
    b.requirements[0] = { ...certificate, overridable: true };
    expect(evaluateProcurementPolicy(document([a, b]), input()).issues.join(' ')).toContain('Conflicting requirement');
  });

  test('supplier minimum is accumulated independently of internal approval count', () => {
    const candidates = [rule(), rule({ id: 'suppliers', type: 'supplier_participation', stages: [], minimumSupplierProposals: 3 }), rule({ id: 'more-suppliers', type: 'supplier_participation', stages: [], minimumSupplierProposals: 5 })];
    const result = evaluateProcurementPolicy(document(candidates), input());
    expect(result.minimumSupplierProposals).toBe(5);
    expect(result.stages).toHaveLength(1);
  });

  test('deduplicates reordered product, category and equivalent sets without mutating them', () => {
    const requirement = {
      ...certificate, productIds: ['p2', 'p1'], categoryIds: ['c2', 'c1'],
      credential: { ...certificate.credential!, acceptedEquivalentIds: ['e2', 'e1'] },
    };
    const reordered = {
      ...requirement, productIds: ['p1', 'p2'], categoryIds: ['c1', 'c2'],
      credential: { ...requirement.credential, acceptedEquivalentIds: ['e1', 'e2'] },
    };
    const doc = document([rule({ id: 'a', requirements: [requirement] }), rule({ id: 'b', requirements: [reordered] })]);
    const before = JSON.stringify(doc);
    const result = evaluateProcurementPolicy(doc, input());
    expect(result.status).toBe('ready');
    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0].sourceRuleIds).toEqual(['a', 'b']);
    expect(JSON.stringify(doc)).toBe(before);
    expect(result).toEqual(evaluateProcurementPolicy({ ...doc, rules: [...doc.rules].reverse() }, input()));
  });

  test.each(['productIds', 'categoryIds', 'acceptedEquivalentIds'] as const)('still blocks genuinely different %s sets', (field) => {
    const requirement = {
      ...certificate, productIds: ['p1'], categoryIds: ['c1'],
      credential: { ...certificate.credential!, acceptedEquivalentIds: ['e1'] },
    };
    const different = field === 'acceptedEquivalentIds'
      ? { ...requirement, credential: { ...requirement.credential, acceptedEquivalentIds: ['e2'] } }
      : { ...requirement, [field]: ['different'] };
    const result = evaluateProcurementPolicy(document([
      rule({ id: 'a', requirements: [requirement] }), rule({ id: 'b', requirements: [different] }),
    ]), input());
    expect(result.status).toBe('blocked');
    expect(result.issues.join(' ')).toContain('Conflicting requirement insurance');
  });

  test('AI is planned but never executed and human stages remain required', () => {
    const ai = stage({ id: 'ai', decisionMode: 'automatic_ai', approverIds: [], quorum: { mode: 'first_response' }, delegatedAgentId: 'agent' });
    const result = evaluateProcurementPolicy(document([rule({ stages: [ai, stage()] })]), input());
    expect(result).toMatchObject({ status: 'ready', authorized: false, simulationOnly: true });
    expect(result.stages).toHaveLength(2);
    expect(result.explanations.join(' ')).toContain('not executed');
    expect(result).not.toHaveProperty('decision');
  });

  test('blocks self-approval when it makes a quorum impossible', () => {
    expect(evaluateProcurementPolicy(document([rule()]), input({ requesterId: 'alice' })).status).toBe('blocked');
    expect(evaluateProcurementPolicy(document([rule({ stages: [stage({ allowSelfApproval: true })] })]), input({ requesterId: 'alice' })).status).toBe('ready');
  });

  test('removes the requester from resolved eligible voters without changing the policy', () => {
    const doc = document([rule({ stages: [stage({ quorum: { mode: 'n_of_m', count: 1 } })] })]);
    const result = evaluateProcurementPolicy(doc, input({ requesterId: 'alice' }));
    expect(result.status).toBe('ready');
    expect(result.stages[0].approverIds).toEqual(['bob']);
    expect(doc.rules[0].stages[0].approverIds).toEqual(['alice', 'bob']);
  });

  test('rejects tampered totals, duplicate lines, gross values, and invalid dates', () => {
    const scenario = input();
    [
      { ...scenario, lines: [{ id: 'line', categoryIds: [], netAmountMinor: 1 }] },
      { ...scenario, netAmountMinor: 2, lines: [{ id: 'a', categoryIds: [], netAmountMinor: 1 }, { id: 'a', categoryIds: [], netAmountMinor: 1 }] },
      { ...scenario, taxAmountMinor: 10 }, { ...scenario, evaluatedAt: 'yesterday' },
    ].forEach((value) => expect(evaluateProcurementPolicy(document(), value).status).toBe('blocked'));
  });

  test('does not mutate policy or input', () => {
    const doc = document([rule()]); const scenario = input();
    const before = JSON.stringify([doc, scenario]);
    evaluateProcurementPolicy(doc, scenario);
    expect(JSON.stringify([doc, scenario])).toBe(before);
  });
});

describe('timings', () => {
  test.each(['+99:00', '+24:00', '+01:99', '-99:00'])('rejects malformed UTC offset %s without throwing in simulation', (offset) => {
    const malformed = `2026-10-27T12:00:00${offset}`;
    expect(timestampSchema.safeParse(malformed).success).toBe(false);
    expect(evaluateProcurementPolicy(document(), { ...input(), evaluatedAt: malformed }).status).toBe('blocked');
    expect(evaluateProcurementPolicy(document([rule()]), { ...input(), stageActivatedAt: malformed }).status).toBe('blocked');
    const candidate = rule();
    candidate.stages[0].deadline = { kind: 'fixed', at: malformed, timeZone: 'UTC' };
    expect(evaluateProcurementPolicy(document([candidate]), input()).status).toBe('blocked');
    candidate.stages[0].deadline = null;
    candidate.effectiveUntil = malformed;
    expect(evaluateProcurementPolicy(document([candidate]), input()).status).toBe('blocked');
  });
  test.each(['2026-10-27T12:00:00Z', '2026-10-27T12:00:00+05:30', '2026-10-27T12:00:00-06:00'])('accepts valid timestamp %s', (timestamp) => {
    expect(timestampSchema.safeParse(timestamp).success).toBe(true);
  });
  const duration = (unit: 'hours' | 'days' | 'weeks'): Timing => timingSchema.parse({ kind: 'duration', value: 1, unit, anchor: 'stage_activation', calendar: 'calendar', timeZone: 'America/Mexico_City' });
  test.each([['hours', '2026-10-27T13:00:00.000Z'], ['days', '2026-10-28T12:00:00.000Z'], ['weeks', '2026-11-03T12:00:00.000Z']] as const)('resolves %s from explicit activation', (unit, expected) => {
    const result = evaluateProcurementPolicy(document([rule({ stages: [stage({ deadline: duration(unit) })] })]), input({ stageActivatedAt: now }));
    expect(result.stages[0].resolvedDeadline).toBe(expected);
    expect(result.status).toBe('ready');
  });
  test('fixed deadlines require zone, expire at equality, and never authorize by timeout', () => {
    const deadline = timingSchema.parse({ kind: 'fixed', at: now, timeZone: 'UTC' });
    expect(timingSchema.safeParse({ kind: 'fixed', at: now }).success).toBe(false);
    expect(timingSchema.safeParse({ kind: 'fixed', at: now, timeZone: 'not/a-zone' }).success).toBe(false);
    const result = evaluateProcurementPolicy(document([rule({ stages: [stage({ deadline })] })]), input());
    expect(result.status).toBe('blocked'); expect(result.authorized).toBe(false);
    expect(result.issues.join(' ')).toContain('deadline reached');
  });
  test('missing anchors and unresolved business calendars block', () => {
    const deadline = duration('days');
    expect(evaluateProcurementPolicy(document([rule({ stages: [stage({ deadline })] })]), input()).status).toBe('blocked');
    expect(timingSchema.safeParse({ ...deadline, calendar: 'business' }).success).toBe(false);
    const business = timingSchema.parse({ ...deadline, calendar: 'business', businessCalendarId: 'calendar' });
    const result = evaluateProcurementPolicy(document([rule({ stages: [stage({ deadline: business })] })]), input({ stageActivatedAt: now }));
    expect(result.status).toBe('blocked');
    expect(result.stages[0].resolvedDeadline).toBeNull();
  });
});