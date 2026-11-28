/** @jest-environment node */
import { posOrderVersion } from '@/app/pos/order-version'
import { actorSql, ids, isolatedPostgres, migration, postgresAvailable, uuid } from '../security/isolated-postgres'
import { installSelfServiceFixture, productId } from '../commerce/self-service-postgres-fixture'
import { openSql, payment, registerIds } from './register-postgres-fixture'

const suite = postgresAvailable ? describe : describe.skip
const order = uuid(600), promo = uuid(601), oldOwner = uuid(602), owner = uuid(603), line = uuid(604)
const sale = registerIds.secondSale, key = 'original-receipt'
const service = (sql: string) => actorSql(sql, ids.owner, 'service_role')
const sqlJson = (value: unknown) => `'${JSON.stringify(value)}'::jsonb`
const signature = 'public.pos_checkout_recover_cash(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb,uuid,text,jsonb,uuid)'

suite('manual admission for the failed ordinary Shop promo cash checkout', () => {
  const pg = isolatedPostgres()
  let originalOrder: Record<string, unknown>, baseline: string
  const cash = payment({ amount: 120, tendered: 130, change: 10 })
  const patches = () => [sqlJson({ source: 'shop', status: 'completed', amount: 120, amount_due: 0, payments: [cash] }),
    sqlJson({ subtotal: 140, total: 120, discount_total: 20, promotion_id: promo, items: [{ quantity: 2 }] }),
    sqlJson({ amount: 80, amount_due: 80, payments: [] }), sqlJson(originalOrder)].join(',')
  const recover = () => `SELECT public.pos_checkout_recover_cash('${ids.site}','${key}','${owner}','${order}',${patches()},
    '${ids.owner}','fingerprint','${baseline}','${registerIds.payment}')`
  const proof = () => pg.db(`SELECT state || ':' || owner_token::text || ':' || coalesce(sale_id::text,'none')
    FROM public.pos_checkout_attempts`)
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    installSelfServiceFixture(pg.db)
    pg.db(migration('20261027190000_pos_checkout_cancel.sql'))
    pg.db(`SET request.jwt.claims='{"sub":"${ids.owner}","role":"service_role"}';
      CREATE TABLE public.pos_client_mutations(site_id uuid,client_mutation_id text);
      ALTER TABLE public.sale_order_items ADD COLUMN unit_price numeric DEFAULT 100;
      UPDATE public.sales SET source='shop',payments='[]',amount=80,amount_due=80 WHERE id='${sale}';
      INSERT INTO public.sale_orders(id,site_id,sale_id,origin_location_id,subtotal,total,discount_total,promotion_id)
      VALUES('${order}','${ids.site}','${sale}','${registerIds.location}',100,80,20,'${promo}');
      INSERT INTO public.sale_order_items(id,sale_order_id,site_id,catalog_item_id,quantity)
      VALUES('${line}','${order}','${ids.site}','${productId}',1)`)
    pg.call(openSql())
    originalOrder = JSON.parse(pg.db(`SELECT to_jsonb(o) FROM public.sale_orders o WHERE id='${order}'`))
    const lines = JSON.parse(pg.db(`SELECT jsonb_agg(i) FROM public.sale_order_items i WHERE sale_order_id='${order}'`))
    baseline = posOrderVersion({ ...originalOrder, sales: { status: 'pending', amount: 80, amount_due: 80, payments: [] }, sale_order_items: lines })
    pg.db(service(`SELECT public.pos_checkout_claim('${ids.site}','${key}','${ids.owner}','${order}','fingerprint','${oldOwner}');
      SELECT public.pos_checkout_transition('${ids.site}','${key}','${oldOwner}','writes_started');`))
    // Reproduce the original rejected SQL, then apply both forward migrations.
    pg.db(migration('20261022220002_self_service_pos_cash_source.sql'))
    expect(() => pg.db(service(`SELECT public.pos_checkout_commit_order('${ids.site}','${key}','${oldOwner}','${order}',${patches()})`))).toThrow('Invalid checkout financial state')
    pg.db(service(`SELECT public.pos_checkout_transition('${ids.site}','${key}','${oldOwner}','review_required')`))
    pg.db(migration('20261128010000_pos_recorded_shop_promo_commit.sql'))
    pg.db(migration('20261128020000_pos_received_cash_recovery.sql'))
  })

  it('records exactly one receipt under competing manual dispatches and fences the original owner', async () => {
    expect(proof()).toBe(`review_required:${oldOwner}:none`)
    pg.db(`SET request.jwt.claims='{"sub":"${ids.owner}","role":"service_role"}';
      UPDATE public.sale_orders SET status='completed' WHERE id='${order}';`)
    originalOrder = JSON.parse(pg.db(`SELECT to_jsonb(o) FROM public.sale_orders o WHERE id='${order}'`))
    const attempts = await Promise.allSettled([pg.concurrent(service(recover())), pg.concurrent(service(recover().replace(owner, uuid(620))))])
    expect(attempts.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(pg.db(`SELECT count(*) FROM public.pos_register_receipts WHERE sale_id='${sale}' AND id='${registerIds.payment}'`)).toBe('1')
    expect(pg.db(`SELECT source || ':' || amount_due FROM public.sales WHERE id='${sale}'`)).toBe('shop:0')
    expect(pg.db(service(`SELECT public.pos_checkout_transition('${ids.site}','${key}','${oldOwner}','review_required')`))).toBe('f')
    pg.db(`UPDATE public.pos_checkout_attempts SET state='review_required'`)
    expect(() => pg.db(service(recover()))).toThrow('precommit')
  })

  it('refuses stale or conflicting evidence and rolls back a rejected nested commit', () => {
    const call = recover()
    for (const [from, to] of [["'fingerprint'", "'changed'"], [`'${ids.owner}','fingerprint'`, `'${ids.admin}','fingerprint'`],
      ['"unit_price":100', '"unit_price":101'], ['"amount":120', '"amount":119'], ['"method":"cash"', '"method":"transfer"'],
      ['"status":"draft"', '"status":"cancelled"'],
      [registerIds.session, uuid(640)]]) {
      const altered = call.replace(from, to)
      expect(altered).not.toBe(call)
      expect(() => pg.db(service(altered))).toThrow()
      expect(proof()).toBe(`review_required:${oldOwner}:none`)
    }
    pg.db(`INSERT INTO public.pos_client_mutations VALUES('${ids.site}','${key}')`)
    expect(() => pg.db(service(call))).toThrow('verified unpaid')
    pg.db(`DELETE FROM public.pos_client_mutations; UPDATE public.sale_order_items SET metadata='{"self_service":true}' WHERE id='${line}'`)
    expect(() => pg.db(service(call))).toThrow('cannot be recovered')
    expect(pg.db('SELECT count(*) FROM public.pos_register_receipts')).toBe('0')
  })

  it('denies recovery on any retained receipt even when there is no attempt.sale_id or sale payment JSON', () => {
    pg.db(`INSERT INTO public.pos_register_receipts(id,session_id,site_id,sale_id,method,amount,tendered,change,actor_id)
      VALUES('${registerIds.payment}','${registerIds.session}','${ids.site}','${registerIds.sale}','cash',120,130,10,'${ids.owner}')`)
    expect(() => pg.db(service(recover()))).toThrow('verified unpaid')
    expect(proof()).toBe(`review_required:${oldOwner}:none`)
  })

  it('is not callable by browser roles and never admits processing, rejected or absent attempts', () => {
    for (const role of ['anon','authenticated']) expect(pg.db(`SELECT has_function_privilege('${role}','${signature}','EXECUTE')`)).toBe('f')
    for (const state of ['processing','rejected','writes_started','completed']) {
      pg.db(`UPDATE public.pos_checkout_attempts SET state='${state}'`)
      expect(() => pg.db(service(recover()))).toThrow('precommit')
    }
    pg.db('DELETE FROM public.pos_checkout_attempts')
    expect(() => pg.db(service(recover()))).toThrow('precommit')
  })
})