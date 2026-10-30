import type { z } from 'zod';

type I18n = {
  t: (key: string, params?: Record<string, string | number>) => string;
  message: (value: string) => string;
  valueLabel: (value: string) => string;
  formatNumber: (value: number | string) => string;
};
export type PolicyFeedback = string | { key: string; params?: Record<string, string | number> }
  | { issues: { path: string | (string | number)[]; message: string }[] };

export class PolicyFeedbackError extends Error {
  constructor(readonly feedback: PolicyFeedback) { super('Policy request failed'); }
}

const validationKeys: Record<string, string> = {
  'Identifiers must be distinct': 'distinctIds',
  'Use a valid timestamp and UTC offset': 'timestamp',
  'Use a valid IANA time zone': 'timeZone',
  'Business durations require a business calendar': 'businessCalendar',
  'Automatic AI requires explicit delegated agent authority': 'delegatedAgent',
  'Use a separate human stage for human approvals': 'separateHumanStage',
  'One agent cannot manufacture multiple votes': 'singleAgentVote',
  'A human stage requires eligible approvers': 'humanApprovers',
  'Quorum exceeds eligible approvers': 'quorum',
  'Only automatic AI may hold delegated decision authority': 'automaticAuthority',
  'Mandatory humans must be eligible approvers': 'mandatoryApprovers',
  'Escalation requires recipients': 'escalation',
  'Stage identifiers must be distinct': 'distinctStages',
  'Approval requires stages': 'approvalStages',
  'Only certification requirements must specify credential semantics': 'credential',
  'Use an uppercase three-letter currency code': 'currency',
  'An inclusive range requires an upper bound at least equal to its lower bound': 'range',
  'Upper bounds are only allowed for ranges': 'upperBound',
  'Effective end must follow effective start': 'effectiveEnd',
  'Requirement identifiers must be distinct within a rule': 'distinctRequirements',
  'Active approval rules require stages': 'activeApproval',
  'Active requirement rules require outcomes': 'activeRequirements',
  'Active supplier rules require a proposal count': 'activeSupplier',
  'Enabled exceptions require an explicit supervisor': 'supervisor',
  'Exception kinds must be distinct': 'distinctExceptions',
  'Rule identifiers must be distinct': 'distinctRules',
  'Line identifiers must be distinct': 'distinctLines',
  'Line net amounts must equal the document net total': 'lineTotal',
};

const fieldKeys: Record<string, string> = {
  settings: 'page.settings', rules: 'page.rules', name: 'rules.name', version: 'validation.field.version',
  id: 'validation.field.id', timeZone: 'settings.timeZone', crossRuleCounting: 'settings.counting',
  fallback: 'settings.fallback', mode: 'validation.field.mode', supervisorId: 'settings.supervisor',
  substituteIds: 'settings.substitutes', visibility: 'settings.visibility', participation: 'settings.participation',
  offerOpening: 'settings.opening', allowGlobalListing: 'settings.listing', timings: 'settings.deadlines',
  tenderResponse: 'settings.timing.tenderResponse', clarification: 'settings.timing.clarification',
  offerValidity: 'settings.timing.offerValidity', approval: 'settings.timing.approval', exceptions: 'settings.exceptions',
  kind: 'validation.field.kind', allowedActions: 'rules.actions', urgentPreset: 'settings.urgent',
  responseTiming: 'settings.urgentResponse', decisionMode: 'stage.decisionMode',
  minimumSupplierProposals: 'rule.minimumProposals', rejectionNotifications: 'settings.notifications',
  notifyRequester: 'settings.notifyRequester', notifyParticipants: 'settings.notifyParticipants',
  recipientIds: 'settings.recipients', notifyPreviousEligibleSuppliers: 'settings.urgentNotify',
  stages: 'rule.approvals', approverIds: 'stage.approvers', mandatoryApproverIds: 'stage.mandatory',
  quorum: 'stage.quorum', count: 'stage.count', rejectionBehavior: 'stage.rejection', execution: 'stage.execution',
  allowSelfApproval: 'stage.selfApproval', delegatedAgentId: 'stage.agent', deadline: 'stage.deadline',
  timeoutAction: 'stage.timeout', escalationIds: 'stage.escalation', requirements: 'rule.requirements',
  credential: 'validation.field.credential', holder: 'requirement.holder', validity: 'requirement.validity',
  acceptedEquivalentIds: 'validation.field.equivalents', review: 'requirement.review',
  evidenceRequired: 'requirement.evidence', classification: 'requirement.classification',
  milestone: 'requirement.milestone', overridable: 'requirement.exception', productIds: 'rule.products',
  productId: 'rule.products', categoryIds: 'rule.categories', description: 'rule.descriptionLabel',
  status: 'rule.status', type: 'rule.type', event: 'rule.event', scope: 'rule.conditions',
  lineMatch: 'rule.lineMatch', requesterIds: 'rule.requesters', requesterId: 'simulator.requester',
  responsibleIds: 'rule.responsible', responsibleId: 'simulator.responsible', amount: 'rule.amount',
  operator: 'rule.operator', currency: 'simulator.currency', valueMinor: 'rule.amount', maxMinor: 'rule.upper',
  basis: 'rule.basis', effectiveFrom: 'rule.from', effectiveUntil: 'rule.until', lines: 'validation.field.lines',
  netAmountMinor: 'simulator.total', evaluatedAt: 'simulator.evaluatedAt', publicationAt: 'simulator.publicationAt',
  stageActivatedAt: 'simulator.stageActivatedAt', value: 'validation.field.value', unit: 'timing.unit',
  anchor: 'timing.anchor', calendar: 'timing.calendar', businessCalendarId: 'timing.businessReference',
  at: 'stage.deadline', document: 'validation.field.document', override: 'validation.field.override',
  expected_revision: 'validation.field.revision', aiRecommendation: 'validation.field.aiRecommendation',
  decisionAuthority: 'validation.field.authority', justificationRequired: 'validation.field.justification',
  preserveMandatoryRequirements: 'validation.field.preserveMandatory',
};

function validationMessage(raw: string, i18n: I18n): string {
  const { t, valueLabel, formatNumber } = i18n;
  const key = validationKeys[raw];
  if (key) return t(`procurement.policy.validation.${key}`);
  if (raw === 'Required') return t('procurement.policy.validation.required');
  if (raw === 'Invalid datetime') return t('procurement.policy.validation.timestamp');
  if (raw === 'Invalid') return t('procurement.policy.validation.invalid');
  if (raw === 'Expected integer, received float') return t('procurement.policy.validation.integer');
  let match = /^(String|Array|Number) must (contain|be) (at least|at most|greater than or equal to|less than or equal to) (\d+)(?: character\(s\)| element\(s\))?$/.exec(raw);
  if (match) return t(`procurement.policy.validation.${match[1].toLowerCase()}${['at least', 'greater than or equal to'].includes(match[3]) ? 'Min' : 'Max'}`, { number: formatNumber(match[4]) });
  match = /^Expected (.+), received (.+)$/.exec(raw);
  if (match) return t('procurement.policy.validation.expected', { expected: t(`procurement.policy.validation.type.${match[1]}`), received: t(`procurement.policy.validation.type.${match[2]}`) });
  match = /^Invalid enum value\. Expected (.+), received (.+)$/.exec(raw);
  if (match) return t('procurement.policy.validation.enum', { values: match[1].split(' | ').map(value => valueLabel(value.replaceAll("'", ''))).join(', '), received: match[2] });
  if (raw.startsWith('Invalid literal value, expected ')) return t('procurement.policy.validation.literal', { value: raw.slice(32) });
  if (raw.startsWith('Invalid discriminator value. Expected ')) return t('procurement.policy.validation.choice');
  if (raw.startsWith('Unrecognized key(s) in object: ')) return t('procurement.policy.validation.extraFields', { fields: raw.slice(30) });
  if (raw === 'Invalid input') return t('procurement.policy.validation.invalid');
  return i18n.message(raw);
}

export function policyFieldLabel(name: string, i18n: I18n): string | null {
  return fieldKeys[name] ? i18n.t(`procurement.policy.${fieldKeys[name]}`) : null;
}

export function policyIssue(issue: { path: string | (string | number)[]; message: string }, i18n: I18n): string {
  const path = (Array.isArray(issue.path) ? issue.path : issue.path.split('.')).filter(value => value !== '').map(part => {
    if (typeof part === 'number' || /^\d+$/.test(part)) return i18n.formatNumber(Number(part) + 1);
    return fieldKeys[part] ? i18n.t(`procurement.policy.${fieldKeys[part]}`) : part;
  }).join(' › ');
  const text = validationMessage(issue.message, i18n);
  return path ? `${path}: ${text}` : text;
}

export function policyFeedback(value: PolicyFeedback | null, i18n: I18n): string {
  if (!value) return '';
  if (typeof value === 'string') return i18n.message(value);
  if ('issues' in value) return value.issues.map(issue => policyIssue(issue, i18n)).join('; ');
  const params = value.params?.number !== undefined ? { ...value.params, number: i18n.formatNumber(value.params.number) } : value.params;
  return i18n.t(value.key, params);
}

/** Translate presentation only; the evaluator's canonical result remains untouched. */
export function simulationText(raw: string, i18n: I18n): string {
  const { t, valueLabel, formatNumber } = i18n;
  const exact: Record<string, string> = {
    'Simulation only: no approvals, AI decisions, or downstream operations are executed.': 'only',
    'Deadline is outside the supported date range.': 'dateRange',
    'The effective fallback blocks progression until an explicit policy is configured.': 'fallbackBlock',
    'The configured fallback explicitly requires no approval; this is not transition authorization.': 'fallbackNone',
  };
  if (exact[raw]) return t(`procurement.policy.simulation.${exact[raw]}`);
  let match = /^Business calendar (.+) must be resolved by an authorized calendar service\.$/.exec(raw);
  if (match) return t('procurement.policy.simulation.businessCalendar', { calendar: match[1] });
  match = /^Missing deadline anchor: (.+)\.$/.exec(raw);
  if (match) return t('procurement.policy.simulation.anchor', { anchor: valueLabel(match[1]) });
  match = /^(.+): missing (requester|responsible person)\.$/.exec(raw);
  if (match) return t('procurement.policy.simulation.missingPerson', { name: match[1], person: t(match[2] === 'requester' ? 'procurement.policy.simulator.requester' : 'procurement.policy.simulator.responsible') });
  const suffixes: Record<string, string> = {
    ': line inputs are required to evaluate scope.': 'lines',
    ': product/category classification is missing for a required scope.': 'classification',
    ': requester is required to evaluate self-approval restrictions.': 'requester',
    ': self-approval restrictions make the configured quorum impossible.': 'selfApproval',
  };
  for (const [suffix, key] of Object.entries(suffixes)) if (raw.endsWith(suffix)) return t(`procurement.policy.simulation.${key}`, { name: raw.slice(0, -suffix.length) });
  match = /^(.+): no authorized dated FX conversion from (.+) to (.+)\.$/.exec(raw);
  if (match) return t('procurement.policy.simulation.fx', { name: match[1], from: match[2], to: match[3] });
  match = /^(.+): compared (\d+) (.+) net minor units \((.+)\)\.$/.exec(raw);
  if (match) return t('procurement.policy.simulation.compared', { name: match[1], amount: formatNumber(match[2]), currency: match[3], basis: valueLabel(match[4]) });
  match = /^(.+): deadline reached; timeout action is (.+), never approval\.$/.exec(raw);
  if (match) return t('procurement.policy.simulation.timeout', { name: match[1], action: valueLabel(match[2]) });
  match = /^(.+): AI (decision|recommendation) is not executed by this simulator\.$/.exec(raw);
  if (match) return t(match[2] === 'decision' ? 'procurement.policy.simulation.aiDecision' : 'procurement.policy.simulation.aiRecommendation', { name: match[1] });
  match = /^Conflicting requirement (.+); no rule may overwrite another requirement\.$/.exec(raw);
  if (match) return t('procurement.policy.simulation.conflict', { id: match[1] });
  match = /^No rules matched; using (.+) fallback \((.+)\)\.$/.exec(raw);
  if (match) return t('procurement.policy.simulation.fallback', { source: t(`procurement.policy.simulator.source.${match[1]}`), mode: valueLabel(match[2]) });
  match = /^([\w.]*): (.+)$/.exec(raw);
  if (match) return policyIssue({ path: match[1], message: match[2] }, i18n);
  return validationMessage(raw, i18n);
}

export function validationFeedback(issues: z.ZodIssue[]): PolicyFeedback { return { issues }; }