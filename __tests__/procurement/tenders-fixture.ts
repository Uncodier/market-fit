import { installRequestsFixture } from './requests-fixture'
import { ids, sqlJson, isolatedPostgres, uuid } from './storage-fixture'
import { migration } from '../security/isolated-postgres'
export const supplierId = uuid(801)
export const tenderDocument = {
  title: 'Office equipment', description: 'Published specifications', request_id: null,
  currency: 'USD', visibility: 'public', global_visible: true, participation: 'invitation_only', opening_policy: 'after_close',
  participation_deadline: '2090-02-01T12:00:00Z', opening_at: '2090-02-02T12:00:00Z',
  requirements: [{ id: uuid(800), description: 'Ergonomic chairs', quantity: 5, unit: 'each', unit_net_minor: 25000, catalog_item_id: null }],
}
export function installTendersFixture(pg: ReturnType<typeof isolatedPostgres>) {
  installRequestsFixture(pg)
  pg.db(`CREATE TABLE public.suppliers(id uuid PRIMARY KEY,site_id uuid REFERENCES public.sites,name text,status text,UNIQUE(site_id,id));
    INSERT INTO public.suppliers VALUES('${supplierId}','${ids.site}','Approved supplier','approved'),('${uuid(802)}','${ids.otherSite}','Foreign supplier','approved');`)
  pg.db(migration('20261027172000_procurement_tenders.sql'))
  pg.db(migration('20261027172001_procurement_tender_publications.sql'))
  pg.call(`SELECT public.configure_procurement_tender_portal('${ids.site}',true);`)
  pg.call(`SELECT public.save_procurement_policy('${ids.site}',0,'{"version":1,"settings":{"allowGlobalListing":true},"rules":[]}'::jsonb);`)
}
export const saveTender = (id: string | null = null, version = 0, document: unknown = tenderDocument) =>
  `SELECT public.save_procurement_tender('${ids.site}',${id ? `'${id}'` : 'NULL'},${version},${sqlJson(document)});`
export const materialize = (id: string, version = 1, actor = ids.owner) =>
  `SELECT public.procurement_materialize_tender_publication('${ids.site}','${id}',${version},'${actor}');`