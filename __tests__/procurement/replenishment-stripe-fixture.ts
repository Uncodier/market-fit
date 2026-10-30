import { ids, isolatedPostgres, migration, uuid } from '../security/isolated-postgres'
import { itemId } from './requests-fixture'
import { locationId, ruleDocument, saveRule } from './replenishment-fixture'

type Pg = ReturnType<typeof isolatedPostgres>
export const stripeIds = { item: uuid(9001), sale: uuid(9002), order: uuid(9003), claim: uuid(9004) }
export const stripeEffectSql = `SELECT public.apply_stripe_sale_inventory_effect(
  '${stripeIds.sale}','${stripeIds.order}','cs_local_replenishment','${stripeIds.claim}');`
export const serviceSql = (sql: string, name = 'replenishment-worker') => `SET application_name='${name}';
  SET ROLE service_role; SET request.jwt.claims='{"role":"service_role"}'; ${sql}`

export function installStripeReplenishmentFixture(pg: Pg, reverse: boolean) {
  pg.db(`INSERT INTO public.catalog_items(id,site_id,name,cost,currency,status,track_inventory)
      VALUES('${stripeIds.item}','${ids.site}','Second SKU',10,'USD','active',true);
    SET request.jwt.claims='{"sub":"${ids.owner}"}';
    UPDATE public.catalog_items SET procurement_enabled=true WHERE id='${stripeIds.item}';
    INSERT INTO public.inventory_levels VALUES('${uuid(9005)}','${ids.site}','${stripeIds.item}','${locationId}',2,now());
    ALTER TABLE public.inventory_levels ADD UNIQUE(catalog_item_id,location_id);
    ALTER TABLE public.inventory_levels ALTER COLUMN id SET DEFAULT gen_random_uuid();
    CREATE TABLE public.stripe_sale_checkout_effects(stripe_session_id text PRIMARY KEY,sale_id uuid,order_id uuid,
      fulfillment_status text,fulfillment_claim_token uuid,inventory_completed_at timestamptz,updated_at timestamptz);
    CREATE TABLE public.sales(id uuid PRIMARY KEY,site_id uuid,stripe_checkout_session_id text);
    CREATE TABLE public.sale_orders(id uuid PRIMARY KEY,sale_id uuid,site_id uuid,items jsonb,origin_location_id uuid);
    CREATE TABLE public.sale_order_items(sale_order_id uuid,catalog_item_id uuid,quantity integer);
    CREATE TABLE public.settings(site_id uuid,commerce jsonb);
    INSERT INTO public.stripe_sale_checkout_effects VALUES('cs_local_replenishment','${stripeIds.sale}',
      '${stripeIds.order}','processing','${stripeIds.claim}',NULL,now());
    INSERT INTO public.sales VALUES('${stripeIds.sale}','${ids.site}','cs_local_replenishment');
    INSERT INTO public.sale_orders VALUES('${stripeIds.order}','${stripeIds.sale}','${ids.site}','[]','${locationId}');`)
  const skuOrder = reverse ? [stripeIds.item, itemId] : [itemId, stripeIds.item]
  pg.db(`INSERT INTO public.sale_order_items VALUES ${skuOrder.map(item => `('${stripeIds.order}','${item}',1)`).join(',')};`)
  // Actual production classifier and Stripe inventory effect, not a synthetic
  // replacement for either lock ordering or the stock mutation path.
  const classifier = migration('20261022220000_self_service_payment_guards.sql')
  pg.db(classifier.slice(classifier.indexOf('CREATE OR REPLACE FUNCTION public.is_self_service_order_items(')).split('$$;')[0] + '$$;')
  const stripe = migration('20261022220001_self_service_atomic_release.sql')
  pg.db(stripe.slice(stripe.indexOf('CREATE OR REPLACE FUNCTION public.apply_stripe_sale_inventory_effect('), stripe.indexOf('COMMIT;')))
  pg.db(`GRANT ALL ON public.stripe_sale_checkout_effects,public.sales,public.sale_orders,public.sale_order_items,public.settings TO postgres;
    GRANT INSERT ON public.inventory_levels TO postgres;
    ALTER FUNCTION public.apply_stripe_sale_inventory_effect(uuid,uuid,text,uuid) OWNER TO postgres;`)
  const ruleA = pg.call(saveRule())
  const ruleB = pg.call(saveRule({ ...ruleDocument, catalog_item_id: stripeIds.item }))
  // Observe the real query's row order rather than assuming SQL without ORDER BY
  // has a guaranteed SKU order. Put the worker in the opposite order explicitly.
  const stripeOrder = pg.db(`SELECT soi.catalog_item_id FROM public.sale_order_items soi
    JOIN public.catalog_items ci ON ci.id=soi.catalog_item_id WHERE soi.sale_order_id='${stripeIds.order}'
      AND soi.catalog_item_id IS NOT NULL AND ci.track_inventory=true;`).split('\n')
  const firstRule = stripeOrder[1] === itemId ? ruleA : ruleB
  pg.db(`UPDATE public.procurement_replenishment_queue SET updated_at='2000-01-02';
    UPDATE public.procurement_replenishment_queue SET updated_at='2000-01-01' WHERE rule_id='${firstRule}';
    CREATE TABLE public.stripe_inventory_trace(sequence integer GENERATED ALWAYS AS IDENTITY,item uuid);
    CREATE FUNCTION public.trace_stripe_inventory() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      INSERT INTO public.stripe_inventory_trace(item) VALUES(NEW.catalog_item_id); RETURN NEW; END $$;
    CREATE TRIGGER trace_stripe_inventory AFTER UPDATE ON public.inventory_levels
      FOR EACH ROW EXECUTE FUNCTION public.trace_stripe_inventory();
    GRANT ALL ON public.stripe_inventory_trace TO postgres;
    GRANT USAGE ON SEQUENCE public.stripe_inventory_trace_sequence_seq TO postgres;`)
  return { firstRule, stripeOrder }
}

export async function waitFor(pg: Pg, condition: string) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (pg.db(`SELECT (${condition})::boolean;`) === 't') return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`Database barrier timed out: ${condition}`)
}

export async function holdGate(pg: Pg, key = 91001) {
  const running = pg.concurrent(`SET application_name='replenishment-gate';
    SELECT pg_advisory_lock(${key}); SELECT pg_sleep(15);`).catch(() => '')
  await waitFor(pg, `EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=${key} AND granted)`)
  return async () => {
    pg.db("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='replenishment-gate';")
    await running
  }
}

export function pauseAcknowledgment(pg: Pg, rule: string, key = 91001) {
  pg.db(`CREATE FUNCTION public.pause_replenishment_ack() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.rule_id='${rule}' THEN PERFORM pg_advisory_xact_lock(${key}); END IF; RETURN NEW; END $$;
    CREATE TRIGGER pause_replenishment_ack AFTER UPDATE OF evaluated_generation ON public.procurement_replenishment_queue
      FOR EACH ROW EXECUTE FUNCTION public.pause_replenishment_ack();`)
}