import { installCommerceFixture, ids, uuid, supplierId, quoteDocument } from './commerce-fixture'
import { isolatedPostgres, migration } from '../security/isolated-postgres'
import { sqlJson } from './storage-fixture'

export { ids, uuid, supplierId, quoteDocument, sqlJson }
export const metadata = { holder_kind: 'person', holder_name: 'Personal holder', title: 'Professional license',
  type: 'professional_license', issuer: 'Licensing body', reference: 'ABC', scope: 'Engineering',
  issued_on: '2025-01-01', expires_on: '2090-01-01', non_expiring: false }
export const reserve = (id: string | null = null, version = 0, document: unknown = metadata, bytes = 10) =>
  `SELECT reserve_procurement_credential(${id ? `'${id}'` : 'NULL'},${version},${sqlJson(document)},'license.pdf','application/pdf',${bytes});`
export function installEvidenceFixture(pg: ReturnType<typeof isolatedPostgres>, realSuppliers = false) {
  installCommerceFixture(pg, realSuppliers)
  pg.db(`DROP SCHEMA IF EXISTS storage CASCADE; CREATE SCHEMA storage;
    GRANT USAGE ON SCHEMA storage TO authenticated,anon,postgres;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz);
    INSERT INTO auth.users SELECT id,now() FROM (VALUES('${ids.owner}'::uuid),('${ids.admin}'),('${ids.foreign}'),('${ids.inactive}')) account(id);
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets,name text,metadata jsonb,UNIQUE(bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON storage.objects TO authenticated,anon;
    CREATE POLICY legacy_open_storage ON storage.objects FOR ALL USING(true) WITH CHECK(true);`)
  for (const file of ['20261027174000_procurement_supplier_representation.sql', '20261027174001_procurement_credentials.sql',
    '20261027174200_procurement_submission_evidence.sql']) pg.db(migration(file))
  pg.db(`GRANT ALL ON ALL TABLES IN SCHEMA public,storage,auth TO postgres;
    DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature); END LOOP; END $$;`)
}
export function upload(pg: ReturnType<typeof isolatedPostgres>, actor = ids.foreign, id: string | null = null, version = 0) {
  const result = JSON.parse(pg.call(reserve(id, version), actor))
  pg.call(`INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('procurement-credentials','${result.object_path}','{"size":10,"mimetype":"application/pdf"}');`, actor)
  pg.call(`SELECT complete_procurement_credential('${result.revision_id}');`, actor)
  return result as { credential_id: string; revision_id: string; object_path: string; version: number }
}