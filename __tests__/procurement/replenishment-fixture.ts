import { installCommerceFixture } from './commerce-fixture'
import { itemId } from './requests-fixture'
import { ids, isolatedPostgres, migration, uuid } from '../security/isolated-postgres'
import { sqlJson } from './storage-fixture'

export const locationId = uuid(1200)
export const secondLocationId = uuid(1201)
export const inventoryId = uuid(1202)
export const ruleDocument = {
  name: 'Warehouse stock rule',
  catalog_item_id: itemId, location_id: locationId, minimum: 3,
  target: 12, minimum_order: 5, order_multiple: 4, action: 'draft', enabled: true,
}
export function installReplenishmentFixture(pg: ReturnType<typeof isolatedPostgres>) {
  installCommerceFixture(pg, true)
  // Verified legacy inventory shape: deliberately no incoming/reservation fields.
  pg.db(`CREATE TABLE public.locations(id uuid PRIMARY KEY,site_id uuid,name text,is_active boolean);
    CREATE TABLE public.inventory_levels(id uuid PRIMARY KEY,site_id uuid,catalog_item_id uuid,location_id uuid,quantity numeric,updated_at timestamptz);
    ALTER TABLE public.catalog_items ADD COLUMN track_inventory boolean NOT NULL DEFAULT true;
    INSERT INTO public.locations VALUES('${locationId}','${ids.site}','Main warehouse',true),
      ('${secondLocationId}','${ids.site}','Second warehouse',true);
    INSERT INTO public.inventory_levels VALUES('${inventoryId}','${ids.site}','${itemId}','${locationId}',2.5,now());`)
  pg.db(migration('20261027175000_catalog_procurement.sql'))
  pg.call(`UPDATE public.catalog_items SET procurement_enabled=true;`)
  pg.db(migration('20261028010000_procurement_replenishment.sql'))
  pg.db(`GRANT SELECT,UPDATE ON public.inventory_levels,public.locations,public.catalog_items TO postgres;
    ALTER TABLE public.procurement_replenishment_rules OWNER TO postgres;
    ALTER TABLE public.procurement_replenishment_cases OWNER TO postgres;
    ALTER FUNCTION public.save_procurement_replenishment_rule(uuid,uuid,integer,jsonb) OWNER TO postgres;
    ALTER FUNCTION public.lock_procurement_replenishment_supply() OWNER TO postgres;
    ALTER FUNCTION public.evaluate_procurement_replenishment_rule(uuid,uuid) OWNER TO postgres;
    ALTER FUNCTION public.close_procurement_replenishment_case(uuid,uuid,text) OWNER TO postgres;`)
}
export const saveRule = (document: unknown = ruleDocument, id: string | null = null, version = 0, site = ids.site) =>
  `SELECT public.save_procurement_replenishment_rule('${site}',${id ? `'${id}'` : 'NULL'},${version},${sqlJson(document)});`
export const evaluateRule = (rule: string, site = ids.site) =>
  `SELECT public.evaluate_procurement_replenishment_rule('${site}','${rule}');`
export const closeCase = (id: string, reason = 'Verified supply will not cover this location') =>
  `SELECT public.close_procurement_replenishment_case('${ids.site}','${id}','${reason.replace(/'/g, "''")}');`

export function installReplenishmentQueue(pg: ReturnType<typeof isolatedPostgres>) {
  pg.db(migration('20261028010001_procurement_replenishment_queue.sql'))
  pg.db(migration('20261028021000_procurement_replenishment_repair.sql'))
  pg.db(`ALTER TABLE public.procurement_replenishment_queue OWNER TO postgres;
    ALTER FUNCTION public.enqueue_procurement_replenishment() OWNER TO postgres;
    ALTER FUNCTION public.process_procurement_replenishment(integer) OWNER TO postgres;`)
}

export function seedReplenishmentRules(pg: ReturnType<typeof isolatedPostgres>, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const location = uuid(2000 + index)
    pg.db(`INSERT INTO public.locations VALUES('${location}','${ids.site}','Queue warehouse ${index}',true);
      INSERT INTO public.inventory_levels VALUES('${uuid(3000 + index)}','${ids.site}','${itemId}','${location}',1,now());`)
    return pg.call(saveRule({ ...ruleDocument, location_id: location, action: 'alert' }))
  })
}