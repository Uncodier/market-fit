/** @jest-environment node */
import { createHash, randomBytes } from 'node:crypto';
import { MarketplaceDatabase, id, integration, location, operator, owner, postgresAvailable, site } from './database-harness';

const suite = postgresAvailable ? describe : describe.skip;
const opaque = () => randomBytes(48).toString('base64');
const digest = () => createHash('sha256').update(randomBytes(32)).digest('hex');
const json = (value: unknown) => `'${JSON.stringify(value).replace(/'/g, "''")}'`;
suite('manager-authorized live provisioning status in isolated PostgreSQL', () => {
  const db = new MarketplaceDatabase();
  let connectionId: string, claimId: string;
  beforeAll(() => { db.start(); db.createRoles(); });
  afterAll(() => db.stop());
  beforeEach(() => {
    db.reset();
    const stateHash = digest();
    const session = JSON.parse(db.actor(`SELECT begin_marketplace_oauth(${json({
      site_id: site, provider: 'rappi', environment: 'sandbox', country: 'MX', credential_mode: 'platform',
    })},'${stateHash}','${opaque()}','${owner}')`));
    db.actor(`SELECT claim_marketplace_oauth('${stateHash}','rappi','${owner}')`);
    connectionId = JSON.parse(db.actor(`SELECT complete_marketplace_oauth('${session.id}','${opaque()}',
      now()+interval '1 hour','${digest()}','${owner}',${json([{ id: 'store-test' }])})`)).connection_id;
    db.actor(`SELECT save_marketplace_integration(${json({
      id: integration, site_id: site, provider: 'rappi', environment: 'sandbox', country: 'MX',
      external_store_id: 'store-test', origin_location_id: location, credential_mode: 'platform',
      merchant_connection_id: connectionId, enabled: false,
    })},NULL,NULL,'${owner}')`);
    claimId = JSON.parse(db.actor(`SELECT claim_marketplace_provisioning('${integration}','activate','${owner}')`)).batch_id;
    db.actor(`SELECT finish_marketplace_provisioning('${integration}','${claimId}','unknown','${owner}',NULL)`);
  });
  const status = (value = 'active', actor = owner) => JSON.parse(db.actor(
    `SELECT reconcile_marketplace_provisioning_status('${integration}','${actor}','${value}')`, actor));
  const event = (batch: string | null, value = 'active') => db.actor(
    `SELECT reconcile_marketplace_provisioning('${integration}',${batch === null ? 'NULL' : `'${batch}'`},'${value}')`);

  it('resolves a lost Rappi batch from live active state without weakening batch-authenticated callbacks', () => {
    expect(db.sql('SELECT provider_batch_id IS NULL FROM marketplace_integrations')).toBe('t');
    expect(() => event(null)).toThrow('batch receipt unavailable');
    expect(() => event('unrecorded-batch')).toThrow('batch receipt unavailable');
    const resolved = status();
    expect(resolved).toMatchObject({ provisioning_status: 'active', provisioning_result: 'confirmed', enabled: true,
      provider_batch_id: null, provisioning_claim_id: claimId });
    expect(resolved).not.toHaveProperty('encrypted_authorization');
    expect(resolved).not.toHaveProperty('app_client_id_hash');
    expect(status()).toEqual(resolved);
    expect(status('revoked').provisioning_status).toBe('active');
    expect(() => event(null)).toThrow('batch receipt unavailable');
  });

  it('rejects missing/cross-site/non-manager/suspended/archived actors and browser grants without mutation', () => {
    const original = db.sql('SELECT row_to_json(i) FROM marketplace_integrations i');
    for (const actor of [operator, id(3), id(5)]) expect(() => status('active', actor)).toThrow('insufficient site permission');
    expect(() => db.actor(`SELECT reconcile_marketplace_provisioning_status('${integration}',NULL,'active')`))
      .toThrow('backend actor required');
    for (const role of ['anon', 'authenticated']) {
      expect(() => db.actor(`SELECT reconcile_marketplace_provisioning_status('${integration}','${owner}','active')`, owner, role))
        .toThrow('permission denied');
    }
    expect(db.sql('SELECT row_to_json(i) FROM marketplace_integrations i')).toBe(original);
    db.sql(`UPDATE sites SET archived_at=now() WHERE id='${site}'`);
    expect(() => status()).toThrow('insufficient site permission');
    expect(db.sql('SELECT row_to_json(i) FROM marketplace_integrations i')).toBe(original);
  });

  it('rejects mismatched operation and invalid status while retaining uncertain claim recovery', () => {
    expect(() => status('revoked')).toThrow('operation mismatch');
    expect(() => status('pending')).toThrow('Invalid provisioning status');
    expect(db.sql('SELECT provisioning_result FROM marketplace_integrations')).toBe('unknown');
    expect(status('failed')).toMatchObject({ provisioning_status: 'not_ready', provisioning_result: 'failed', enabled: false });
    const activateClaim = JSON.parse(db.actor(`SELECT claim_marketplace_provisioning('${integration}','activate','${owner}')`));
    db.actor(`SELECT finish_marketplace_provisioning('${integration}','${activateClaim.batch_id}','confirmed','${owner}',NULL)`);
    const deactivateClaim = JSON.parse(db.actor(`SELECT claim_marketplace_provisioning('${integration}','deactivate','${owner}')`));
    db.actor(`SELECT finish_marketplace_provisioning('${integration}','${deactivateClaim.batch_id}','unknown','${owner}',NULL)`);
    expect(() => status()).toThrow('operation mismatch');
    expect(status('revoked')).toMatchObject({ provisioning_status: 'revoked', enabled: false,
      provisioning_claim_id: deactivateClaim.batch_id });
  });

  it('retains exact persisted batch matching for stale callback events before and after live status reconciliation', () => {
    db.actor(`SELECT finish_marketplace_provisioning('${integration}','${claimId}','pending','${owner}','recorded-batch')`);
    const before = db.sql('SELECT row_to_json(i) FROM marketplace_integrations i');
    expect(() => event('old-batch')).toThrow('identity mismatch');
    expect(db.sql('SELECT row_to_json(i) FROM marketplace_integrations i')).toBe(before);
    status();
    const active = db.sql('SELECT row_to_json(i) FROM marketplace_integrations i');
    expect(() => event('old-batch', 'failed')).toThrow('identity mismatch');
    expect(() => event(null, 'failed')).toThrow('identity mismatch');
    expect(db.sql('SELECT row_to_json(i) FROM marketplace_integrations i')).toBe(active);
  });

  it('requires current store authorization to enable but keeps operational activation independent of merchant token expiry', () => {
    db.actor(`UPDATE marketplace_merchant_connections SET authorized_stores='[]' WHERE id='${connectionId}'`);
    expect(() => status()).toThrow('authorization unavailable');
    db.actor(`UPDATE marketplace_merchant_connections SET authorized_stores=${json([{ id: 'store-test' }])},
      token_expires_at=now()-interval '1 minute' WHERE id='${connectionId}'`);
    expect(status().enabled).toBe(true);
    db.actor(`SELECT revoke_marketplace_merchant_connection('${connectionId}','${owner}')`);
    expect(() => status()).toThrow('authorization unavailable');
  });
});