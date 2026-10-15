/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MarketplaceDatabase, id, integration, migrationNames, normalizedOrder, operator, owner,
  postgresAvailable, secret, site } from './database-harness';

const suite = postgresAvailable ? describe : describe.skip;
describe('marketplace migration source contract', () => {
  it('is forward-only transactional SQL, split below 500 lines with no credential table', () => {
    for (const name of migrationNames) {
      const sql = readFileSync(path.join(process.cwd(), 'supabase/migrations', name), 'utf8');
      expect(sql.split('\n').length).toBeLessThan(500);
      expect(sql).toContain('BEGIN;'); expect(sql.trim().endsWith('COMMIT;')).toBe(true);
      expect(sql).not.toMatch(/DISABLE TRIGGER|session_replication_role|CREATE TABLE.*credentials/i);
    }
  });
});

suite('marketplace migrations in disposable socket-only PostgreSQL', () => {
  const db = new MarketplaceDatabase();
  beforeAll(() => { db.start(); db.createRoles(); });
  afterAll(() => db.stop());
  beforeEach(() => { db.reset(); db.configure(); });
  const claim = (orderId: string, action = 'accept', actor = operator) => JSON.parse(db.actor(
    `SELECT claim_marketplace_action('${orderId}','${action}','${actor}');`));
  const finish = (actionId: string, result: string, metadata = {}) => JSON.parse(db.actor(
    `SELECT finish_marketplace_action('${actionId}','${result}','${JSON.stringify(metadata)}');`));

  it('atomically imports native sales/orders/lines/modifiers/shipment without settling or inventory', () => {
    const input = { ...normalizedOrder(), notes: 'Test delivery instruction' };
    input.items[0] = { ...input.items[0], notes: 'No vinegar' } as typeof input.items[0];
    const imported = db.ingest(input);
    expect(imported.duplicate).toBe(false); expect(imported.shipment_id).toBeTruthy();
    const order = JSON.parse(db.sql(`SELECT row_to_json(o) FROM sale_orders o WHERE id='${imported.order_id}'`));
    expect(order.status).toBe('draft'); expect(order.currency).toBe('MXN'); expect(order.tax_total).toBe(5);
    expect(order.items[0].unitPrice).toBe(50); expect(order.metadata.marketplace.state).toBe('pending');
    expect(order.notes).toBe('Test delivery instruction');
    expect(order.items[0].description).toBe('No vinegar');
    expect(db.sql("SELECT description FROM sale_order_items WHERE parent_sale_order_item_id IS NULL")).toBe('No vinegar');
    expect(order.created_by_user_id).toBeNull(); expect(order.seller_user_id).toBeNull();
    expect(db.sql('SELECT status||\':\'||amount_due::text FROM sales')).toBe('pending:0');
    expect(db.sql('SELECT count(*) FROM sale_order_items')).toBe('2');
    expect(db.sql('SELECT sum(subtotal) FROM sale_order_items')).toBe('100');
    expect(db.sql('SELECT count(*) FROM sale_order_item_units')).toBe('2');
    expect(db.sql('SELECT count(*) FROM sale_order_items WHERE catalog_item_id IS NOT NULL')).toBe('0');
    expect(db.sql('SELECT stock_decremented FROM shipments')).toBe('f');
    expect(db.sql("SELECT metadata#>>'{marketplace,courier,name}' FROM shipments")).toBe('Test courier');
    expect(db.sql('SELECT count(*) FROM profiles')).toBe('5');
    expect(db.sql("SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='shipments'")).toBe('1');
  });

  it('deduplicates receipts and concurrent deliveries, preserves native identities across updates', async () => {
    const order = normalizedOrder();
    const statement = `SET ROLE service_role; SELECT ingest_marketplace_event('${integration}','concurrent',
      '${JSON.stringify(order)}','2026-10-14T12:00:00Z');`;
    const results = (await Promise.all([db.concurrent(statement), db.concurrent(statement)])).map(value => JSON.parse(value));
    expect(results.map(value => value.duplicate).sort()).toEqual([false, true]);
    expect(results[0].order_id).toBe(results[1].order_id);
    const updated = db.ingest(normalizedOrder('accepted'), 'accepted', '2026-10-14T12:01:00Z');
    expect(updated.order_id).toBe(results[0].order_id);
    expect(db.sql('SELECT count(*) FROM sales')).toBe('1');
    expect(db.sql('SELECT count(*) FROM shipments')).toBe('1');
    expect(db.sql('SELECT count(*) FROM sale_order_items')).toBe('2');
    expect(db.sql('SELECT DISTINCT status FROM sale_order_item_units')).toBe('new');
  });

  it('rolls back receipt and every native entity on invalid line and leaves retry possible', () => {
    const invalid = normalizedOrder(); invalid.items[0].quantity = -1;
    expect(() => db.ingest(invalid)).toThrow('Invalid normalized item');
    for (const table of ['marketplace_events', 'sales', 'sale_orders', 'sale_order_items', 'shipments']) {
      expect(db.sql(`SELECT count(*) FROM ${table}`)).toBe('0');
    }
    expect(db.ingest(normalizedOrder()).duplicate).toBe(false);
  });

  it('persists cancel-before-import and never reopens authoritative cancelled native orders', () => {
    db.ingest({ external_order_id: 'order-test', event_kind: 'cancel' }, 'cancel-first');
    const imported = db.ingest(normalizedOrder(), 'order-later', '2026-10-14T12:02:00Z');
    expect(db.sql(`SELECT status FROM sale_orders WHERE id='${imported.order_id}'`)).toBe('cancelled');
    db.ingest(normalizedOrder('accepted'), 'accepted-later', '2026-10-14T12:03:00Z');
    expect(db.sql("SELECT metadata#>>'{marketplace,state}' FROM sale_orders")).toBe('cancelled');
    expect(db.sql('SELECT status FROM shipments')).toBe('cancelled');
  });

  it('retains early courier data and ignores out-of-order state regressions', () => {
    db.ingest({ external_order_id: 'order-test', event_kind: 'delivery',
      delivery: { courier: { name: 'Early courier' }, eta_minutes: 5 } }, 'early');
    const order = normalizedOrder('ready'); delete (order as Partial<typeof order>).delivery;
    db.ingest(order, 'ready', '2026-10-14T12:02:00Z');
    expect(db.sql("SELECT metadata#>>'{marketplace,courier,name}' FROM shipments")).toBe('Early courier');
    db.ingest(normalizedOrder(), 'stale', '2026-10-14T12:01:00Z');
    expect(db.sql("SELECT metadata#>>'{marketplace,state}' FROM sale_orders")).toBe('ready');
  });

  it('blocks browser writes, unlinking, deletion, unit definer mutations and external courier pings', () => {
    const { order_id: orderId, shipment_id: shipmentId } = db.ingest(normalizedOrder());
    for (const sql of [
      `UPDATE sale_orders SET status='pending' WHERE id='${orderId}'`,
      `UPDATE sale_orders SET marketplace_integration_id=NULL,external_order_id=NULL,metadata='{}' WHERE id='${orderId}'`,
      `DELETE FROM sale_orders WHERE id='${orderId}'`,
      'UPDATE sale_order_items SET status=\'completed\'',
      'UPDATE sales SET status=\'completed\'', 'UPDATE shipments SET last_lat=10',
      `INSERT INTO shipment_location_pings(site_id,shipment_id,user_id,lat,lng) VALUES('${site}','${shipmentId}','${owner}',1,2)`,
    ]) expect(() => db.actor(sql, owner, 'authenticated')).toThrow('provider-owned');
    db.actor('UPDATE sale_order_item_units SET status=\'completed\'', owner, 'authenticated');
    expect(db.sql('SELECT DISTINCT status FROM sale_order_item_units')).toBe('draft');
    const unitId = db.sql('SELECT id FROM sale_order_item_units LIMIT 1');
    expect(() => db.actor(`SELECT mutate_sale_order_item_units('${site}',ARRAY['${unitId}'::uuid],'cancel')`,
      owner, 'authenticated')).toThrow('provider-owned');
    expect(db.sql('SELECT status FROM sale_orders')).toBe('draft');
    expect(() => db.actor(`SELECT ingest_marketplace_event('${integration}','browser','{}')`, owner, 'authenticated')).toThrow('permission denied');
    expect(() => db.actor(`SELECT claim_marketplace_action('${orderId}','accept','${owner}')`, owner, 'authenticated')).toThrow('permission denied');
  });

  it('hides reserved native secrets despite legacy policies, protecting old and new images', () => {
    expect(db.actor('SELECT count(*) FROM site_secrets', owner, 'authenticated')).toBe('0');
    expect(db.actor('SELECT count(*) FROM site_secrets', owner, 'anon')).toBe('0');
    db.sql(`INSERT INTO site_secrets(site_id,name,provider,use_case,encrypted_value)
      VALUES('${site}','Ordinary test secret','other','ordinary',repeat('synthetic-',3))`);
    expect(db.actor('SELECT count(*) FROM site_secrets', owner, 'authenticated')).toBe('1');
    expect(() => db.actor("UPDATE site_secrets SET use_case='marketplace:forged' WHERE use_case='ordinary'", owner, 'authenticated')).toThrow();
    db.actor(`UPDATE site_secrets SET encrypted_value=repeat('synthetic-rotated-',3) WHERE id='${secret}'`);
    expect(() => db.actor(`UPDATE site_secrets SET use_case='ordinary' WHERE id='${secret}'`, owner, 'authenticated')).not.toThrow();
    expect(db.sql(`SELECT use_case FROM site_secrets WHERE id='${secret}'`)).toBe(`marketplace:${integration}`);
  });

  it('reads config only for native active members and denies unauthorized actor claims', () => {
    expect(db.actor('SELECT count(*) FROM marketplace_integrations', owner, 'authenticated')).toBe('1');
    expect(db.actor('SELECT count(*) FROM marketplace_integrations', operator, 'authenticated')).toBe('1');
    expect(db.actor('SELECT count(*) FROM marketplace_integrations', id(3), 'authenticated')).toBe('0');
    const imported = db.ingest(normalizedOrder());
    for (const actor of [id(3), id(4), id(5)]) expect(() => claim(imported.order_id, 'accept', actor)).toThrow('insufficient');
    db.sql(`UPDATE site_members SET license_suspended=true WHERE user_id='${operator}'`);
    expect(() => claim(imported.order_id)).toThrow('insufficient');
    db.sql(`UPDATE site_members SET license_suspended=false,restrict_to_assigned_only=true WHERE user_id='${operator}'`);
    expect(() => claim(imported.order_id)).toThrow('must be assigned');
  });

  it('claims once under concurrency, preserves unknown outcomes and resolves with authoritative webhook', async () => {
    const { order_id: orderId } = db.ingest(normalizedOrder());
    const sql = `SET ROLE service_role; SELECT claim_marketplace_action('${orderId}','accept','${operator}');`;
    const attempts = (await Promise.all([db.concurrent(sql), db.concurrent(sql)])).map(value => JSON.parse(value));
    expect(attempts.map(value => value.duplicate).sort()).toEqual([false, true]);
    const actionId = attempts[0].action_id;
    expect(finish(actionId, 'unknown').operation.status).toBe('unknown');
    expect(finish(actionId, 'failed').operation.status).toBe('unknown');
    expect(claim(orderId).duplicate).toBe(true);
    db.ingest(normalizedOrder(), 'unrelated', '2026-10-14T12:01:00Z');
    expect(claim(orderId).operation.status).toBe('unknown');
    db.ingest(normalizedOrder('accepted'), 'authoritative', '2026-10-14T12:02:00Z');
    expect(db.sql('SELECT status FROM marketplace_actions')).toBe('confirmed');
    expect(db.sql('SELECT status FROM sale_orders')).toBe('pending');
    expect(db.sql('SELECT status FROM sales')).toBe('pending');
    expect(finish(actionId, 'unknown').operation.status).toBe('confirmed');
  });

  it('accept does not settle sales; Uber reject stays draft and can receive authoritative acceptance', () => {
    const { order_id: orderId } = db.ingest(normalizedOrder());
    const rejected = claim(orderId, 'reject'); finish(rejected.action_id, 'confirmed');
    expect(db.sql('SELECT status FROM sale_orders')).toBe('draft');
    expect(db.sql("SELECT metadata#>>'{marketplace,state}' FROM sale_orders")).toBe('rejected');
    db.ingest(normalizedOrder('accepted'), 'accepted', '2026-10-14T12:02:00Z');
    expect(db.sql('SELECT status FROM sale_orders')).toBe('pending');
    expect(db.sql('SELECT status FROM sales')).toBe('pending');
    expect(() => claim(orderId, 'ready')).toThrow('unavailable');
  });

  it('scheduled/provisional/expired orders fail closed and Rappi ready requires manual flag', () => {
    const order = normalizedOrder('scheduled'); db.ingest(order);
    const orderId = db.sql('SELECT id FROM sale_orders');
    expect(() => claim(orderId)).toThrow('unavailable');
    const pending = { ...normalizedOrder(), accept_by: '2000-01-01T00:00:00Z' };
    db.ingest(pending, 'expired', '2026-10-14T12:02:00Z');
    expect(() => claim(orderId)).toThrow('unavailable');
  });

  it('Rappi definitive rejection cancels locally and manual-ready capability is enforced', () => {
    db.reset(); db.configure('rappi');
    const { order_id: orderId } = db.ingest(normalizedOrder());
    const accepted = claim(orderId); finish(accepted.action_id, 'confirmed');
    db.sql(`UPDATE marketplace_integrations SET manual_ready=false WHERE id='${integration}'`);
    expect(() => claim(orderId, 'ready')).toThrow('unavailable');
    db.sql(`UPDATE marketplace_integrations SET manual_ready=true WHERE id='${integration}'`);
    const ready = claim(orderId, 'ready'); finish(ready.action_id, 'confirmed');
    expect(db.sql('SELECT status FROM sale_orders')).toBe('in_progress');
    expect(db.sql('SELECT status FROM sales')).toBe('pending');
    expect(() => claim(orderId, 'cancel')).toThrow('unavailable');
    db.reset(); db.configure('rappi');
    const rejectedOrder = db.ingest(normalizedOrder()).order_id;
    finish(claim(rejectedOrder, 'reject').action_id, 'confirmed');
    expect(db.sql('SELECT status FROM sale_orders')).toBe('cancelled');
  });

  it('ignores provisional downgrade, supports recursive modifiers and snapshot reconciliation', () => {
    const order = normalizedOrder('accepted');
    order.items[0].modifiers[0].modifiers = [{ external_id: 'nested', name: 'Nested test choice', quantity: 1,
      unit_price: 2, total: 2, modifiers: [] }] as never[];
    db.ingest(order);
    expect(db.sql('SELECT count(*) FROM sale_order_items')).toBe('3');
    expect(db.sql('SELECT sum(subtotal) FROM sale_order_items')).toBe('100');
    const provisional = normalizedOrder('scheduled'); provisional.totals_provisional = true;
    provisional.total = 0; provisional.subtotal = 0; provisional.items = [];
    db.ingest(provisional, 'early-scheduled', '2026-10-14T12:03:00Z');
    expect(db.sql('SELECT total FROM sale_orders')).toBe('105');
    expect(db.sql('SELECT count(*) FROM sale_order_items')).toBe('3');
    db.ingest({ ...order, event_kind: 'snapshot', status: 'completed' }, 'snapshot', '2026-10-14T12:04:00Z');
    expect(db.sql('SELECT status FROM sale_orders')).toBe('completed');
    expect(db.sql('SELECT status FROM sales')).toBe('pending');
  });

  it('maps explicit delivery milestones, preserves courier coordinates and rejects browser courier edits', () => {
    db.ingest(normalizedOrder());
    db.ingest({ external_order_id: 'order-test', event_kind: 'delivery', delivery: {
      status: 'DELIVERED', courier: { latitude: 21, longitude: -101 }, estimated_arrival_at: '2026-10-14T13:00:00Z',
    } }, 'delivered', '2026-10-14T12:03:00Z');
    expect(db.sql('SELECT status||\':\'||last_lat::text FROM shipments')).toBe('delivered:21');
    expect(db.sql("SELECT metadata#>>'{marketplace,courier,name}' FROM shipments")).toBe('Test courier');
    db.ingest({ external_order_id: 'order-test', event_kind: 'delivery', delivery: { status: 'PREPARING' } },
      'late-preparing', '2026-10-14T12:04:00Z');
    expect(db.sql('SELECT status FROM shipments')).toBe('delivered');
  });

  it('enforces atomic config tenant binding, immutable secret identity and archive-aware permissions', () => {
    expect(() => db.actor(`UPDATE site_secrets SET use_case='ordinary' WHERE id='${secret}'`)).toThrow('identity is immutable');
    const config = { id: id(31), site_id: site, provider: 'uber_eats', environment: 'sandbox', country: 'US',
      external_store_id: 'other-store', origin_location_id: id(21), enabled: true };
    expect(() => db.actor(`SELECT save_marketplace_integration('${JSON.stringify(config)}','${id(41)}',
      repeat('synthetic-',3),'${owner}')`)).toThrow('Invalid marketplace configuration');
    expect(db.sql(`SELECT count(*) FROM site_secrets WHERE id='${id(41)}'`)).toBe('0');
    const duplicateStore = { ...config, external_store_id: 'store-test', origin_location_id: id(20) };
    expect(() => db.actor(`SELECT save_marketplace_integration('${JSON.stringify(duplicateStore)}','${id(41)}',
      repeat('synthetic-',3),'${owner}')`)).toThrow('duplicate key');
    expect(db.sql(`SELECT count(*) FROM site_secrets WHERE id='${id(41)}'`)).toBe('0');
    const orderId = db.ingest(normalizedOrder()).order_id;
    db.sql(`UPDATE sites SET archived_at=now() WHERE id='${site}'`);
    expect(() => claim(orderId, 'accept', owner)).toThrow('insufficient');
    expect(() => db.ingest(normalizedOrder(), 'archived')).toThrow('unavailable');
    expect(db.actor('SELECT count(*) FROM marketplace_integrations', owner, 'authenticated')).toBe('0');
  });

  it('allows only accepted confirmed bounded printer acknowledgement with provider metadata unchanged', () => {
    db.ingest(normalizedOrder());
    const marker = "UPDATE sale_order_items SET metadata=jsonb_set(metadata,'{printed_quantity}','1') WHERE parent_sale_order_item_id IS NULL";
    expect(() => db.actor(marker, owner, 'authenticated')).toThrow('provider-owned');
    db.ingest(normalizedOrder('accepted'), 'accepted', '2026-10-14T12:01:00Z');
    db.actor(marker, owner, 'authenticated');
    expect(db.sql("SELECT metadata->>'printed_quantity' FROM sale_order_items WHERE parent_sale_order_item_id IS NULL")).toBe('1');
    expect(() => db.actor(marker.replace("'1'", "'3'"), owner, 'authenticated')).toThrow('provider-owned');
    expect(() => db.actor(marker.replace("'{printed_quantity}'", "'{marketplace,state}'"), owner, 'authenticated')).toThrow('provider-owned');
    const orderId = db.sql('SELECT id FROM sale_orders'); claim(orderId, 'cancel');
    expect(() => db.actor(marker, owner, 'authenticated')).toThrow('provider-owned');
  });

  it('durably rate limits concurrent polls without reissuing unknown actions', async () => {
    const sql = 'SET ROLE service_role; SELECT claim_marketplace_poll(3);';
    const results = (await Promise.all([db.concurrent(sql), db.concurrent(sql)])).map(value => JSON.parse(value));
    expect(results.map(value => value.length).sort()).toEqual([0, 1]);
    expect(results.flat()[0].order_list).toBe('new');
    expect(JSON.parse(db.actor('SELECT claim_marketplace_poll(3)'))).toEqual([]);
    expect(() => db.actor('SELECT claim_marketplace_poll(3)', owner, 'authenticated')).toThrow('permission denied');
    db.sql("UPDATE marketplace_integrations SET last_polled_at=now()-interval '46 seconds'");
    expect(JSON.parse(db.actor('SELECT claim_marketplace_poll(3)'))).toEqual([
      { integration_id: integration, provider: 'uber_eats', order_list: 'sent' },
    ]);
  });

  it('does not replace a released pending order with a late provisional notification', () => {
    db.ingest(normalizedOrder());
    const scheduled = { ...normalizedOrder('scheduled'), totals_provisional: true, total: 0, subtotal: 0, items: [] };
    db.ingest(scheduled, 'late-provisional', '2026-10-14T12:01:00Z');
    expect(db.sql('SELECT total FROM sale_orders')).toBe('105');
    expect(db.sql("SELECT metadata#>>'{marketplace,state}' FROM sale_orders")).toBe('pending');
    expect(db.sql('SELECT count(*) FROM sale_order_items')).toBe('2');
  });

  it('does not claim a timed-out acceptance succeeded when the provider cancels the order', () => {
    const orderId = db.ingest(normalizedOrder()).order_id;
    const operation = claim(orderId);
    finish(operation.action_id, 'unknown');
    db.ingest({ external_order_id: 'order-test', event_kind: 'cancel' }, 'cancel', '2026-10-14T12:01:00Z');
    expect(db.sql('SELECT status FROM marketplace_actions')).toBe('failed');
    expect(db.sql("SELECT metadata#>>'{marketplace,operation,status}' FROM sale_orders")).toBe('failed');
    expect(db.sql('SELECT status FROM sale_orders')).toBe('cancelled');
    expect(db.sql("SELECT metadata#>>'{marketplace,state}' FROM shipments")).toBe('cancelled');
  });

  it('synchronizes shipment state when an order action is confirmed', () => {
    const orderId = db.ingest(normalizedOrder()).order_id;
    finish(claim(orderId).action_id, 'confirmed');
    expect(db.sql("SELECT metadata#>>'{marketplace,accepted_at}' IS NOT NULL FROM sale_orders")).toBe('t');
    expect(db.sql('SELECT status FROM shipments')).toBe('preparing');
    expect(db.sql("SELECT metadata#>>'{marketplace,state}' FROM shipments")).toBe('accepted');
    finish(claim(orderId, 'cancel').action_id, 'confirmed');
    expect(db.sql("SELECT metadata#>>'{marketplace,state}' FROM shipments")).toBe('cancelled');
  });

  it('does not attach the previous courier phone to a replacement courier', () => {
    const order = normalizedOrder();
    db.ingest({ ...order, delivery: { courier: { id: 'first', name: 'First courier', phone: '5550100' } } });
    db.ingest({ external_order_id: 'order-test', event_kind: 'delivery', delivery: {
      courier: { id: 'replacement', latitude: 21, longitude: -100 },
    } }, 'replacement', '2026-10-14T12:01:00Z');
    expect(db.sql("SELECT metadata#>>'{marketplace,courier,id}' FROM shipments")).toBe('replacement');
    expect(db.sql("SELECT metadata#>>'{marketplace,courier,phone}' FROM shipments")).toBe('');
    expect(db.sql("SELECT metadata#>>'{marketplace,courier,name}' FROM shipments")).toBe('');
  });

  it('does not restore stale request metadata over a newer provider event', () => {
    const orderId = db.ingest(normalizedOrder()).order_id;
    const operation = claim(orderId);
    db.ingest({ ...normalizedOrder(), customer: { name: 'Updated customer' } }, 'updated', '2026-10-14T12:01:00Z');
    finish(operation.action_id, 'confirmed', { customer: { name: 'Stale customer' }, event_at: '2020-01-01T00:00:00Z' });
    expect(db.sql("SELECT metadata#>>'{marketplace,customer,name}' FROM sale_orders")).toBe('Updated customer');
    expect(db.sql("SELECT (metadata#>>'{marketplace,event_at}')::timestamptz = '2026-10-14T12:01:00Z'::timestamptz FROM sale_orders")).toBe('t');
  });
  it('allows only zero printer acknowledgement after confirmed cancellation', () => {
    db.ingest(normalizedOrder('accepted'));
    db.ingest({ external_order_id: 'order-test', event_kind: 'cancel' }, 'cancel', '2026-10-14T12:01:00Z');
    const marker = "UPDATE sale_order_items SET metadata=jsonb_set(metadata,'{printed_quantity}','0') WHERE parent_sale_order_item_id IS NULL";
    expect(() => db.actor(marker, owner, 'authenticated')).not.toThrow();
    expect(() => db.actor(marker.replace("'0'", "'1'"), owner, 'authenticated')).toThrow('provider-owned');
  });
});