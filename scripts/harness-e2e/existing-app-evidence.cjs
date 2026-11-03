'use strict';

// Pure, fail-closed evaluation of an independently collected v1 evidence bundle.
// No DB, filesystem, clock, environment, network, commands or transcript output.
const { createHash } = require('node:crypto');
const { existingAppCases } = require('./existing-app-cases.cjs');
const digest = value => createHash('sha256').update(value).digest('hex');
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = value => typeof value === 'string' && value.length > 0;
const list = value => Array.isArray(value) ? value : [];
const unique = values => new Set(values).size === values.length;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const timestamp = value => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN;
const path = value => text(value) && !value.includes('\\') &&
  value.split('/').every(part => /^[A-Za-z0-9_.@-]+$/.test(part) && !['.', '..'].includes(part));
const paths = value => Array.isArray(value) && value.length > 0 && value.every(path) && unique(value);
const count = value => Number.isSafeInteger(value) && value >= 0;

// Canonical full manifest digest binds probes to the exact observed file tree.
// The collector hashes raw bytes (not redacted file contents), including untracked
// files. It must reject symlinks and enumerate the agreed application scope fully.
function sourceTreeDigest(files) {
  if (!Array.isArray(files) || files.length === 0 || !unique(files.map(file => file?.path)) ||
    !files.every(file => object(file) && path(file.path) && sha(file.sha256) && count(file.bytes))) return null;
  return digest(JSON.stringify(files.map(file => [file.path, file.sha256, file.bytes])
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
}

function evaluateExistingApp(input) {
  const checks = [];
  const add = (name, passed) => checks.push({ name, passed: passed === true });
  const e = object(input) ? input : {};
  const c = object(e.contract) ? e.contract : {};
  const spec = existingAppCases().find(item => item.id === c.caseId);
  const identityKeys = ['runId', 'siteId', 'userId', 'appId', 'repositoryId', 'requirementId'];
  const sessionKeys = [...identityKeys, 'actionId', 'sessionId', 'requestSha256'];
  const identity = row => object(row) && identityKeys.every(key => row[key] === c[key]);
  const bound = row => identity(row) && sessionKeys.every(key => row[key] === c[key]);
  const contractValid = e.schemaVersion === 1 && !!spec &&
    [...identityKeys, 'actionId', 'sessionId', 'originInstanceId', 'runnerInstanceId', 'collectorId', 'verifierId'].every(key => text(c[key])) &&
    c.collectorId !== c.verifierId && sha(c.verifierSha256) &&
    c.requestSha256 === digest(spec.request) && paths(c.allowedChangePaths) && paths(c.targetSourcePaths) &&
    paths(c.protectedPaths) && c.targetSourcePaths.every(p => c.allowedChangePaths.includes(p)) &&
    c.allowedChangePaths.every(p => !c.protectedPaths.includes(p)) &&
    Number.isSafeInteger(c.deadlineSeconds) && c.deadlineSeconds > 0 && c.deadlineSeconds <= 3600;
  add('input_contract', contractValid);

  const a = object(e.action) ? e.action : {};
  const p = object(e.persistedRequest) ? e.persistedRequest : {};
  const x = object(e.execution) ? e.execution : {};
  const b = object(e.baseline) ? e.baseline : {};
  const f = object(e.finalSource) ? e.finalSource : {};
  const observed = timestamp(e.observedAt), actionAt = timestamp(a.submittedAt);
  const finishedAt = timestamp(a.completedAt), appliedAt = timestamp(p.appliedAt);
  const startedAt = timestamp(x.startedAt), terminalAt = timestamp(x.completedAt);
  const baselineAt = timestamp(b.capturedAt), finalAt = timestamp(f.capturedAt);
  const fresh = at => Number.isFinite(at) && at > actionAt && at <= observed;
  add('evidence_complete', e.complete === true && Array.isArray(e.errors) && e.errors.length === 0 &&
    Number.isFinite(observed) && contractValid);
  add('external_user_action', bound(a) && a.instanceId === c.originInstanceId && a.origin === 'interactive-assistant' &&
    a.actor === 'external-user' && a.status === 'completed' &&
    Number.isFinite(actionAt) && fresh(finishedAt));
  add('persisted_request_matches', bound(p) && p.origin === 'assistant-tool' &&
    p.operation === 'requirements.update' && p.state === 'applied' &&
    fresh(appliedAt) && appliedAt >= finishedAt);
  const requirementBaseline = object(e.requirementBaseline) ? e.requirementBaseline : {};
  add('existing_requirement_revision', contractValid && identity(requirementBaseline) &&
    requirementBaseline.requirementType === spec.requirementType && p.requirementType === spec.requirementType &&
    timestamp(requirementBaseline.createdAt) < actionAt &&
    timestamp(requirementBaseline.observedAt) < actionAt &&
    timestamp(requirementBaseline.observedAt) >= timestamp(requirementBaseline.createdAt) &&
    p.createdAt === requirementBaseline.createdAt && count(requirementBaseline.externalUserActionRevision) &&
    count(p.externalUserActionRevision) && p.externalUserActionRevision > requirementBaseline.externalUserActionRevision &&
    p.lastExternalUserActionId === c.actionId);

  // An instruction update receipt is intake only. Cron must independently have
  // admitted and completed this exact request after the submitting turn ended.
  const mapping = object(e.mapping) ? e.mapping : {};
  add('requirement_session_mapping', bound(mapping) && mapping.runnerInstanceId === c.runnerInstanceId &&
    mapping.origin === 'persisted-requirement-run' && fresh(timestamp(mapping.observedAt)));
  add('cron_execution_matches', bound(x) && x.instanceId === c.runnerInstanceId && x.origin === 'requirement-cron' && text(x.cycleId) &&
    text(x.workspaceId) && x.status === 'completed' && ['on-review', 'done'].includes(x.requirementStatus) &&
    fresh(startedAt) && startedAt > finishedAt && startedAt >= appliedAt &&
    x.externalUserActionRevision === p.externalUserActionRevision &&
    fresh(terminalAt) && terminalAt > startedAt);
  const receipt = object(e.persistenceReceipt) ? e.persistenceReceipt : {};
  const call = object(receipt.call) ? receipt.call : {};
  const result = object(receipt.result) ? receipt.result : {};
  add('fresh_persistence_receipt', bound(call) && bound(result) && text(call.id) && result.callId === call.id &&
    call.tool === 'requirements' && call.operation === 'update' && result.ok === true &&
    result.state === 'queued' && timestamp(call.at) > actionAt &&
    timestamp(result.at) >= timestamp(call.at) && timestamp(result.at) <= finishedAt);

  const manifestValid = (snapshot, baseline) => (baseline ? identity(snapshot) : bound(snapshot)) &&
    snapshot.origin === 'independent-source-read' && snapshot.collectorId === c.collectorId &&
    snapshot.complete === true && snapshot.symlinksAbsent === true &&
    sha(snapshot.treeSha256) && sourceTreeDigest(snapshot.files) === snapshot.treeSha256;
  const baselineValid = manifestValid(b, true) && Number.isFinite(baselineAt) && baselineAt < actionAt;
  const finalValid = manifestValid(f, false) && f.workspaceId === x.workspaceId && fresh(finalAt) && finalAt > terminalAt;
  add('fresh_independent_source', baselineValid && finalValid);
  const before = new Map(list(b.files).map(file => [file?.path, file]));
  const after = new Map(list(f.files).map(file => [file?.path, file]));
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(key => {
    const old = before.get(key), next = after.get(key);
    return !old || !next || old.sha256 !== next.sha256 || old.bytes !== next.bytes;
  });
  add('actual_target_source_diff', contractValid && baselineValid && finalValid && changed.length > 0 &&
    c.targetSourcePaths.some(key => before.has(key) && after.has(key) && after.get(key).bytes > 0 &&
      before.get(key).sha256 !== after.get(key).sha256));
  add('only_allowed_files_changed', contractValid && baselineValid && finalValid &&
    changed.every(key => c.allowedChangePaths.includes(key)));
  add('protected_files_preserved', contractValid && baselineValid && finalValid &&
    c.protectedPaths.every(key => before.has(key) && after.has(key) && !changed.includes(key)));

  const probes = list(e.verifications);
  const allChecks = spec ? [...spec.changeChecks, ...spec.preservationChecks] : [];
  const probeFor = phase => probes.filter(probe => probe?.phase === phase);
  const pre = probeFor('baseline'), post = probeFor('final');
  const validProbe = (probe, snapshot, baseline) => bound(probe) &&
    probe.origin === 'independent-functional-verifier' && probe.verifierId === c.verifierId &&
    probe.verifierSha256 === c.verifierSha256 && text(probe.id) && sha(probe.artifactSha256) &&
    probe.treeSha256 === snapshot.treeSha256 && probe.complete === true &&
    (baseline ? timestamp(probe.startedAt) >= baselineAt && timestamp(probe.completedAt) < actionAt :
      timestamp(probe.startedAt) >= finalAt && fresh(timestamp(probe.completedAt))) &&
    timestamp(probe.completedAt) > timestamp(probe.startedAt) &&
    Array.isArray(probe.checks) && probe.checks.length === allChecks.length &&
    unique(probe.checks.map(check => check?.id)) && probe.checks.every(check =>
      object(check) && allChecks.includes(check.id) && count(check.assertions) && check.assertions > 0 &&
      count(check.failures) && check.failures <= check.assertions);
  const probesValid = contractValid && baselineValid && finalValid && probes.length === 2 &&
    pre.length === 1 && post.length === 1 && pre[0].id !== post[0].id &&
    validProbe(pre[0], b, true) && validProbe(post[0], f, false);
  add('independent_functional_verification', probesValid);
  add('baseline_exposes_requested_gap', probesValid && pre[0].checks.some(check =>
    spec.changeChecks.includes(check.id) && check.failures > 0) &&
    pre[0].checks.filter(check => spec.preservationChecks.includes(check.id)).every(check => check.failures === 0));
  add('requested_behavior_and_preservation_pass', probesValid && post[0].checks.every(check => check.failures === 0));
  add('deadline', contractValid && observed >= actionAt && observed - actionAt <= c.deadlineSeconds * 1000);

  const passed = checks.every(check => check.passed);
  return { schemaVersion: 1, caseId: spec?.id || null,
    state: passed ? 'passed' : !contractValid || e.complete !== true || !Array.isArray(e.errors) || e.errors.length > 0 ? 'blocked' : 'failed',
    passed, checks, metrics: { changedFiles: changed.length, verificationRuns: probes.length } };
}

module.exports = { evaluateExistingApp, sourceTreeDigest };