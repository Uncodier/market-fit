/** @jest-environment node */
import { createHash, randomBytes } from 'node:crypto';
import { MarketplaceDatabase, id, integration, location, normalizedOrder, operator, owner, postgresAvailable, site } from './database-harness';

const suite = postgresAvailable ? describe : describe.skip;
const opaque = () => randomBytes(48).toString('base64');
const digest = () => createHash('sha256').update(randomBytes(32)).digest('hex');
const json = (value: unknown) => `'${JSON.stringify(value).replace(/'/g, "''")}'`;
suite('verified external provider lifecycle in isolated PostgreSQL', () => {
  const db = new MarketplaceDatabase();
  let connectionId: string;
  beforeAll(() => { db.start(); db.createRoles(); });
  afterAll(() => db.stop());
  beforeEach(() => {
    db.reset(); const stateHash = digest();
    const session = JSON.parse(db.actor(`SELECT begin_marketplace_oauth(${json({
      site_id: site, provider: 'rappi', environment: 'sandbox', country: 'MX', credential_mode: 'platform',
    })},'${stateHash}','${opaque()}','${owner}')`));
    db.actor(`SELECT claim_marketplace_oauth('${stateHash}','rappi','${owner}')`);
    connectionId = JSON.parse(db.actor(`SELECT complete_marketplace_oauth('${session.id}','${opaque()}',now()+interval '1 hour',
      '${digest()}','${owner}',${json([{ id: 'store-test' }])})`)).connection_id;
    db.actor(`SELECT save_marketplace_integration(${json({ id: integration, site_id: site, provider: 'rappi',
      environment: 'sandbox', country: 'MX', external_store_id: 'store-test', origin_location_id: location,
      credential_mode: 'platform', merchant_connection_id: connectionId, enabled: false })},NULL,NULL,'${owner}')`);
    const claim = JSON.parse(db.actor(`SELECT claim_marketplace_provisioning('${integration}','activate','${owner}')`));
    db.actor(`SELECT finish_marketplace_provisioning('${integration}','${claim.batch_id}','confirmed','${owner}')`);
  });
  const status = (value: string) => JSON.parse(db.actor(`SELECT reconcile_marketplace_provider_status('${integration}','${value}')`));

  it('revokes an active receiver after verified external deprovisioning even with removed store consent', () => {
    const imported = db.ingest(normalizedOrder());
    db.actor(`UPDATE marketplace_merchant_connections SET authorized_stores='[]' WHERE id='${connectionId}'`);
    const revoked = status('inactive');
    expect(revoked).toMatchObject({ provisioning_status: 'revoked', provisioning_operation: 'deactivate',
      provisioning_result: 'confirmed', enabled: false });
    expect(db.sql('SELECT id FROM shipments')).toBe(imported.shipment_id);
    expect(() => db.ingest(normalizedOrder(), 'after-revoke')).toThrow('unavailable');
    expect(() => status('active')).toThrow('authorization unavailable');
    db.actor(`SELECT revoke_marketplace_merchant_connection('${connectionId}','${owner}')`);
    expect(status('inactive').enabled).toBe(false);
  });

  it('uses live active status instead of stale callback hints and never resurrects externally revoked receivers', () => {
    const before = db.sql('SELECT row_to_json(i) FROM marketplace_integrations i');
    expect(status('active').provisioning_status).toBe('active');
    expect(db.sql('SELECT row_to_json(i) FROM marketplace_integrations i')).toBe(before);
    status('inactive');
    expect(status('active').provisioning_status).toBe('revoked');
    expect(db.sql('SELECT enabled FROM marketplace_integrations')).toBe('f');
  });

  it('demotes external pending state with a fresh unknown claim, blocking actions and replay while preserving courier history', () => {
    const imported = db.ingest(normalizedOrder());
    const oldClaim = db.sql('SELECT provisioning_claim_id FROM marketplace_integrations');
    const pending = status('pending');
    expect(pending).toMatchObject({ provisioning_status: 'pending', provisioning_operation: 'activate', provisioning_result: 'unknown',
      enabled: true, provider_batch_id: null });
    expect(pending.provisioning_claim_id).not.toBe(oldClaim);
    expect(status('pending').provisioning_claim_id).toBe(pending.provisioning_claim_id);
    expect(JSON.parse(db.actor(`SELECT claim_marketplace_provisioning('${integration}','activate','${owner}')`)))
      .toMatchObject({ duplicate: true, batch_id: pending.provisioning_claim_id });
    expect(() => db.actor(`SELECT claim_marketplace_action('${imported.order_id}','accept','${operator}')`)).toThrow('not active');
    expect(JSON.parse(db.actor('SELECT claim_marketplace_poll()'))).toEqual([]);
    expect(status('inactive').provisioning_status).toBe('pending');
    expect(status('active')).toMatchObject({ provisioning_status: 'active', enabled: true, provisioning_result: 'confirmed' });
    expect(db.sql('SELECT id FROM shipments')).toBe(imported.shipment_id);
  });

  it('does not cancel pending disconnect from still-active live status and resolves explicit pending failure', () => {
    const claim = JSON.parse(db.actor(`SELECT claim_marketplace_provisioning('${integration}','deactivate','${owner}')`));
    db.actor(`SELECT finish_marketplace_provisioning('${integration}','${claim.batch_id}','unknown','${owner}')`);
    expect(status('active')).toMatchObject({ provisioning_status: 'pending', provisioning_operation: 'deactivate',
      provisioning_claim_id: claim.batch_id, provisioning_result: 'unknown' });
    expect(status('failed')).toMatchObject({ provisioning_status: 'not_ready', enabled: false, provisioning_result: 'failed' });
  });

  it('allows verified service callbacks when creator leaves, denies browser execution, and keeps manager refresh actor checks', () => {
    db.sql(`UPDATE sites SET user_id='${id(3)}' WHERE id='${site}'`);
    expect(() => db.actor(`SELECT reconcile_marketplace_provisioning_status('${integration}','${owner}','active')`))
      .toThrow('insufficient site permission');
    expect(status('inactive').provisioning_status).toBe('revoked');
    for (const role of ['anon', 'authenticated']) {
      expect(() => db.actor(`SELECT reconcile_marketplace_provider_status('${integration}','inactive')`, owner, role))
        .toThrow('permission denied');
    }
    expect(() => status('bad')).toThrow('Invalid provider status');
  });

  it('shares durable webhook app leases between signed callback and actor-authorized paths without unsafe retries', () => {
    const appHash = digest();
    const actorCall = `SELECT claim_marketplace_webhook_registration('${appHash}','rappi','sandbox','MX','${owner}','${site}')`;
    const callbackCall = `SELECT claim_marketplace_webhook_registration('${appHash}','rappi','sandbox','MX')`;
    db.sql(`UPDATE sites SET user_id='${id(3)}' WHERE id='${site}'`);
    expect(() => db.actor(actorCall)).toThrow('insufficient site permission');
    const lease = JSON.parse(db.actor(callbackCall)); expect(lease.acquired).toBe(true);
    expect(JSON.parse(db.actor(callbackCall)).acquired).toBe(false);
    db.actor(`SELECT finish_marketplace_webhook_registration_app('${lease.claim_id}','unknown')`);
    expect(JSON.parse(db.actor(callbackCall))).toMatchObject({ acquired: false, status: 'unknown' });
    for (const role of ['anon', 'authenticated']) expect(() => db.actor(callbackCall, owner, role)).toThrow('permission denied');
  });
});