const { MARKER } = require('./cases.cjs');

const REQUIREMENT = 'id,site_id,user_id,status,created_at,backlog,metadata,cron_lock_run_id,cron_lock_expires_at,cron_lock_active';
const MAPPING = 'requirement_id,site_id,session_id,generation,last_cycle_id';
const STATUS = 'id,stage,cycle,created_at,message,active_sandbox_id';
const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));

/** Only the injected, authenticated RLS client may inspect product rows. The
 * observer grant is restricted to two scoped SELECTs after fixture verification.
 * No RPCs, session leases, artifact reads, cron controls or mutations belong here.
 */
async function observeCase(spec, run, { client, observer, readFiles, now = () => new Date(), redact } = {}) {
  const paths = Object.keys(spec?.files || {});
  const result = {
    observedAt: null, requirement: null, mapping: null, session: null,
    statuses: [], plans: [], files: Object.fromEntries(paths.map(path => [path, { state: 'unavailable' }])),
    credits: null, complete: true, errors: [],
  };
  const fail = code => {
    result.complete = false;
    if (!result.errors.includes(code)) result.errors.push(code);
  };
  const query = async (code, operation) => {
    try {
      const response = await operation();
      if (!response || response.error) { fail(code); return undefined; }
      return response.data;
    } catch { fail(code); return undefined; }
  };
  // Redact strings rather than serialized objects so JSON tool receipts remain
  // machine-readable and a text-only runner callback is sufficient.
  const clean = value => {
    if (typeof value === 'string') {
      const text = redact(value);
      if (typeof text !== 'string') throw new Error('Invalid redaction result');
      return text;
    }
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]));
    return value;
  };
  const pages = async (code, build, maximum, order) => {
    const rows = [];
    for (let page = 0; page < maximum; page++) {
      const data = await query(code, () => {
        let request = build();
        for (const column of order) request = request.order(column, { ascending: true });
        return request.range(page * 100, page * 100 + 99);
      });
      if (data === undefined) return null;
      if (!Array.isArray(data) || data.length > 100) { fail(code); return null; }
      rows.push(...data);
      if (data.length < 100) return rows;
    }
    // A full last page cannot prove there are no further records.
    fail(`${code}_LIMIT`);
    return null;
  };
  try {
    result.observedAt = new Date(typeof now === 'function' ? now() : now).toISOString();
    const reqid = spec?.requirementId || spec?.reqid;
    if (![reqid, spec?.id, spec?.instanceId, run?.id, run?.siteId, run?.userId].every(value => typeof value === 'string' && value.length > 0) || typeof redact !== 'function') {
      fail('OBSERVATION_INPUT_INVALID'); return result;
    }
    const requirement = await query('REQUIREMENT_UNAVAILABLE', () => client.from('requirements').select(REQUIREMENT)
      .eq('id', reqid).eq('site_id', run.siteId).eq('user_id', run.userId).maybeSingle());
    if (requirement === undefined) return result;
    const marker = requirement?.metadata?.harness_e2e;
    if (!requirement || requirement.id !== reqid || requirement.site_id !== run.siteId || requirement.user_id !== run.userId ||
      requirement.metadata?.runner_instance_id !== spec.instanceId ||
      !marker || Object.keys(marker).length !== 3 || marker.marker !== MARKER || marker.run_id !== run.id || marker.case_id !== spec.id) {
      fail('REQUIREMENT_UNVERIFIED'); return result;
    }
    result.requirement = clean({ ...pick(requirement, REQUIREMENT.split(',').filter(key => key !== 'metadata')),
      metadata: { harness_e2e: { marker: MARKER, run_id: run.id, case_id: spec.id } } });

    const mapping = await query('MAPPING_UNAVAILABLE', () => observer.from('harness_requirement_runs').select(MAPPING)
      .eq('requirement_id', reqid).eq('site_id', run.siteId).maybeSingle());
    if (mapping) {
      if (mapping.requirement_id !== reqid || mapping.site_id !== run.siteId ||
        (mapping.session_id !== null && (typeof mapping.session_id !== 'string' || !mapping.session_id))) {
        fail('MAPPING_UNVERIFIED'); return result;
      }
      result.mapping = clean(pick(mapping, MAPPING.split(',')));
      if (mapping.session_id) {
        const row = await query('SESSION_UNAVAILABLE', () => observer.from('harness_sessions').select('snapshot')
          .eq('id', mapping.session_id).eq('site_id', run.siteId).eq('user_id', run.userId).maybeSingle());
        // A mapping may precede creation of its session; absence is still pending.
        if (row) {
          const snapshot = row.snapshot;
          if (!snapshot || snapshot.id !== mapping.session_id || snapshot.request?.requirementId !== reqid) {
            fail('SESSION_UNVERIFIED'); return result;
          }
          if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > MAX_SNAPSHOT_BYTES ||
            !Array.isArray(snapshot.messages) || snapshot.messages.length > 10000) {
            fail('SESSION_LIMIT'); return result;
          }
          const messages = snapshot.messages.map(message => pick(message, ['role', 'content', 'toolCalls', 'toolCallId']));
          for (const message of messages) {
            if (message.role !== 'tool' || typeof message.content !== 'string') continue;
            try {
              const receipt = JSON.parse(message.content);
              if (hasTruncation(receipt)) fail('ARTIFACT_UNAVAILABLE');
            } catch { /* Unknown tool text is retained, not reinterpreted as success. */ }
          }
          result.session = clean({ ...pick(snapshot, ['id', 'version', 'status', 'turns', 'allocatedTokens', 'activeMs', 'reason', 'createdAt', 'updatedAt']),
            messages, ...(snapshot.workspace ? { workspace: pick(snapshot.workspace, ['provider', 'id', 'root']) } : {}) });
        }
      }
    }

    const statuses = await pages('STATUSES_UNAVAILABLE', () => client.from('requirement_status').select(STATUS)
      .eq('requirement_id', reqid).eq('site_id', run.siteId), 10, ['created_at', 'id']);
    if (statuses) result.statuses = clean(statuses.map(row => pick(row, STATUS.split(','))));
    const plans = await query('PLANS_UNAVAILABLE', () => client.from('instance_plans').select('id,status,steps')
      .eq('site_id', run.siteId).eq('instance_id', spec.instanceId).eq('metadata->>requirement_id', reqid));
    if (plans !== undefined) {
      if (Array.isArray(plans)) result.plans = clean(plans.map(row => pick(row, ['id', 'status', 'steps'])));
      else fail('PLANS_UNAVAILABLE');
    }
    if (result.session) {
      const transactions = await pages('CREDITS_UNAVAILABLE', () => client.from('credit_transactions').select('amount,created_at,metadata')
        .eq('site_id', run.siteId).eq('metadata->>session_id', result.session.id), 5, ['created_at', 'id']);
      if (transactions) {
        if (transactions.every(row => typeof row.amount === 'number' && Number.isFinite(row.amount))) {
          const total = transactions.reduce((sum, row) => sum + Math.max(0, -row.amount), 0);
          if (Number.isFinite(total)) result.credits = total;
          else fail('CREDITS_INVALID');
        } else fail('CREDITS_INVALID');
      }
      // Only an independently verified session can reach the trusted fixed-path
      // file oracle. Missing live files/workspaces are transient, not poll errors.
      if (result.session.workspace?.id && typeof readFiles === 'function') {
        try {
          const observed = await readFiles(result.session, spec);
          result.files = Object.fromEntries(paths.map(path => {
            const file = Array.isArray(observed) ? observed.find(item => item.path === path) : observed?.[path];
            if (!file || !['read', 'missing', 'unavailable'].includes(file.state)) return [path, { state: 'unavailable' }];
            if (file.state !== 'read') return [path, { state: file.state }];
            if (!/^[a-f0-9]{64}$/i.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0) return [path, { state: 'unavailable' }];
            return [path, { state: 'read', sha256: file.sha256, bytes: file.bytes }];
          }));
        } catch { /* No file content, provider details or raw exceptions escape. */ }
      }
    }
  } catch { fail('OBSERVATION_UNAVAILABLE'); }
  return result;
}

function hasTruncation(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.truncated === true) return true;
  return Object.values(value).some(hasTruncation);
}

module.exports = { observeCase };