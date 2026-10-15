/** @jest-environment node */
import { createHash, randomBytes } from 'node:crypto';
import { MarketplaceDatabase, id, integration, location, normalizedOrder, operator, owner,
  postgresAvailable, secret, site } from './database-harness';

const suite = postgresAvailable ? describe : describe.skip;
const opaque = () => randomBytes(48).toString('base64');
const digest = () => createHash('sha256').update(randomBytes(32)).digest('hex');
const json = (value: unknown) => `'${JSON.stringify(value).replace(/'/g, "''")}'`;
suite('explicit same-site merchant reauthorization in isolated PostgreSQL', () => {
  const db = new MarketplaceDatabase();
  let appHash: string;
  beforeAll(() => { db.start(); db.createRoles(); });
  afterAll(() => db.stop());
  beforeEach(() => { db.reset(); appHash = digest(); });
  function connect(options: Record<string, unknown> = {}, stores = [{ id: 'store-test' }], actor = owner, hash = appHash) {
    const context = { site_id: site, provider: 'uber_eats', environment: 'sandbox', country: 'US',
      credential_mode: 'platform', ...options };
    const stateHash = digest();
    const started = JSON.parse(db.actor(`SELECT begin_marketplace_oauth(${json(context)},'${stateHash}','${opaque()}','${actor}')`, actor));
    db.actor(`SELECT claim_marketplace_oauth('${stateHash}','${context.provider}','${actor}')`, actor);
    return JSON.parse(db.actor(`SELECT complete_marketplace_oauth('${started.id}','${opaque()}',now()+interval '1 hour',
      '${hash}','${actor}',${json(stores)})`, actor)).connection_id as string;
  }
  const save = (connectionId: string) => db.actor(`SELECT save_marketplace_integration(${json({
    id: integration, site_id: site, provider: 'uber_eats', environment: 'sandbox', country: 'US',
    external_store_id: 'store-test', origin_location_id: location, credential_mode: 'platform',
    merchant_connection_id: connectionId, enabled: false,
  })},NULL,NULL,'${owner}')`);
  const rebind = (connectionId: string, actor = owner) => JSON.parse(db.actor(
    `SELECT rebind_marketplace_merchant_connection('${integration}','${connectionId}','${actor}')`, actor));
  function activate() {
    const claim = JSON.parse(db.actor(`SELECT claim_marketplace_provisioning('${integration}','activate','${owner}')`));
    db.actor(`SELECT finish_marketplace_provisioning('${integration}','${claim.batch_id}','confirmed','${owner}')`);
  }

  it('denies unauthorized manager/cross-site/provider/environment/country/store/missing/revoked/expired bindings', () => {
    save(connect());
    const valid = connect();
    for (const actor of [operator, id(3), id(5)]) expect(() => rebind(valid, actor)).toThrow('insufficient site permission');
    const invalid = [
      connect({ site_id: id(11) }, undefined, id(3)), connect({ provider: 'rappi', country: 'MX' }),
      connect({ environment: 'production' }), connect({ country: 'CA' }), connect({}, [{ id: 'another-store' }]), id(999),
    ];
    for (const connectionId of invalid) expect(() => rebind(connectionId)).toThrow('binding mismatch');
    db.actor(`SELECT revoke_marketplace_merchant_connection('${valid}','${owner}')`);
    expect(() => rebind(valid)).toThrow('binding mismatch');
    const expired = connect();
    db.actor(`UPDATE marketplace_merchant_connections SET token_expires_at=now()-interval '1 minute' WHERE id='${expired}'`);
    expect(() => rebind(expired)).toThrow('binding mismatch');
    expect(db.sql('SELECT count(*) FROM marketplace_rebind_permits')).toBe('0');
  });

  it('reconnects revoked consent using a new authorized connection without resurrecting old tokens or store history', () => {
    const previous = connect(); save(previous); activate();
    const imported = db.ingest(normalizedOrder());
    db.actor(`SELECT revoke_marketplace_merchant_connection('${previous}','${owner}')`);
    const newConnection = connect({}, undefined, owner, digest());
    const rebound = rebind(newConnection);
    expect(rebound.id).toBe(integration); expect(rebound.merchant_connection_id).toBe(newConnection);
    expect(rebound.provisioning_status).toBe('not_ready'); expect(rebound.enabled).toBe(false);
    for (const field of ['provisioning_operation', 'provisioning_result', 'provisioning_claim_id', 'provider_batch_id']) {
      expect(rebound[field]).toBeNull();
    }
    expect(db.sql(`SELECT status||':'||(encrypted_authorization IS NULL)::text FROM marketplace_merchant_connections
      WHERE id='${previous}'`)).toBe('revoked:true');
    activate();
    expect(db.sql('SELECT id FROM sale_orders')).toBe(imported.order_id);
    expect(db.sql('SELECT id FROM shipments')).toBe(imported.shipment_id);
    expect(db.sql('SELECT count(*) FROM marketplace_integrations')).toBe('1');
  });

  it('reauthorizes active same-app consent preserving operations, courier binding and order action claims', () => {
    const previous = connect(); save(previous); activate();
    const imported = db.ingest(normalizedOrder());
    db.actor(`SELECT claim_marketplace_action('${imported.order_id}','accept','${operator}')`);
    const before = db.sql('SELECT row_to_json(i) FROM marketplace_integrations i');
    const shipmentBefore = db.sql('SELECT row_to_json(s) FROM shipments s');
    const actionBefore = db.sql('SELECT row_to_json(a) FROM marketplace_actions a');
    const rebound = rebind(connect());
    const original = JSON.parse(before);
    for (const field of ['enabled', 'provisioning_status', 'provisioning_operation', 'provisioning_result',
      'provisioning_claim_id', 'provider_batch_id', 'origin_location_id', 'created_by_user_id']) {
      expect(rebound[field]).toEqual(original[field]);
    }
    expect(db.sql('SELECT row_to_json(s) FROM shipments s')).toBe(shipmentBefore);
    expect(db.sql('SELECT row_to_json(a) FROM marketplace_actions a')).toBe(actionBefore);
    expect(JSON.parse(db.actor(`SELECT claim_marketplace_provisioning('${integration}','activate','${owner}')`)).duplicate)
      .toBe(true);
    expect(db.sql(`SELECT status FROM marketplace_merchant_connections WHERE id='${previous}'`)).toBe('authorized');
  });

  it('rejects active different app until confirmed disconnect but permits verified same-app credential-mode changes', () => {
    save(connect()); activate();
    expect(() => rebind(connect({}, undefined, owner, digest()))).toThrow('Disconnect the existing provider app');
    expect(rebind(connect({ credential_mode: 'custom' })))
      .toMatchObject({ credential_mode: 'custom', enabled: true, provisioning_status: 'active', secret_id: null });
    const oldConnection = db.sql('SELECT merchant_connection_id FROM marketplace_integrations');
    db.actor(`SELECT revoke_marketplace_merchant_connection('${oldConnection}','${owner}')`);
    const ownConnection = connect({ credential_mode: 'custom' }, undefined, owner, digest());
    expect(rebind(ownConnection)).toMatchObject({ credential_mode: 'custom', secret_id: null, enabled: false,
      provisioning_status: 'not_ready' });
  });

  it('preserves pending/unknown provider claim recovery when replacing same-app tokens and denies app change', () => {
    save(connect());
    const claim = JSON.parse(db.actor(`SELECT claim_marketplace_provisioning('${integration}','activate','${owner}')`));
    db.actor(`SELECT finish_marketplace_provisioning('${integration}','${claim.batch_id}','unknown','${owner}','batch-synthetic')`);
    const sameApp = connect();
    expect(rebind(sameApp)).toMatchObject({ provisioning_status: 'pending', provisioning_result: 'unknown',
      provisioning_claim_id: claim.batch_id, provider_batch_id: 'batch-synthetic', enabled: true });
    expect(() => rebind(connect({}, undefined, owner, digest()))).toThrow('Disconnect the existing provider app');
    expect(JSON.parse(db.actor(`SELECT claim_marketplace_provisioning('${integration}','activate','${owner}')`)))
      .toMatchObject({ duplicate: true, batch_id: claim.batch_id });
    db.actor(`SELECT reconcile_marketplace_provisioning('${integration}','batch-synthetic','active')`);
    expect(db.sql('SELECT provisioning_status FROM marketplace_integrations')).toBe('active');
  });

  it('migrates explicitly disabled legacy custom configuration without deleting its reserved orphan secret', () => {
    db.configure();
    const ownConnection = connect({ credential_mode: 'custom' });
    expect(() => rebind(ownConnection)).toThrow('Disconnect the existing provider app');
    db.actor('UPDATE marketplace_integrations SET enabled=false');
    const rebound = rebind(ownConnection);
    expect(rebound).toMatchObject({ credential_mode: 'custom', secret_id: null, provisioning_status: 'not_ready', enabled: false });
    expect(db.sql(`SELECT use_case FROM site_secrets WHERE id='${secret}'`)).toBe(`marketplace:${integration}`);
    expect(db.actor('SELECT count(*) FROM site_secrets', owner, 'authenticated')).toBe('0');
  });

  it('does not let browser or arbitrary service writes forge a rebind GUC and always removes the permit', () => {
    save(connect());
    const next = connect();
    for (const role of ['authenticated', 'service_role']) {
      expect(() => db.actor(`SET marketplace.rebind='${id(777)}'; UPDATE marketplace_integrations
        SET merchant_connection_id='${next}'`, owner, role)).toThrow();
      expect(() => db.actor(`INSERT INTO marketplace_rebind_permits(backend_pid,transaction_id,integration_id,connection_id,actor_user_id)
        VALUES(pg_backend_pid(),txid_current(),'${integration}','${next}','${owner}')`, owner, role)).toThrow('permission denied');
    }
    expect(() => db.actor(`SELECT rebind_marketplace_merchant_connection('${integration}','${next}','${owner}')`, owner,
      'authenticated')).toThrow('permission denied');
    const output = db.actor(`BEGIN; SELECT rebind_marketplace_merchant_connection('${integration}','${next}','${owner}');
      SELECT 'guard='||coalesce(current_setting('marketplace.rebind',true),''); COMMIT;`);
    expect(output.split('\n').pop()).toBe('guard=');
    expect(db.sql('SELECT count(*) FROM marketplace_rebind_permits')).toBe('0');
    expect(() => db.actor(`UPDATE marketplace_integrations SET merchant_connection_id=NULL,credential_mode='custom',secret_id='${secret}'`))
      .toThrow('identity is immutable');
  });
});