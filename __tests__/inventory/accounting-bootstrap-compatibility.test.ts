/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { actor, disposablePostgres, ids, postgresAvailable, uuid } from './movements-postgres'
import { accountingFix, partialCall, setupReviewDatabase } from './receipt-review-postgres'
import { jsonSql } from './transfer-orders-postgres'
import { receivers } from './receiving-responsibility-postgres'

const schemaRoot = path.resolve(process.cwd(), '../makinari-db-scheme')
const name = '20261113210450_qa_accounting_wrapper_oid_compatibility.sql'
const compatibility = readFileSync(path.join(schemaRoot, 'bootstrap/supabase/migrations', name), 'utf8')
const signature = '(uuid,uuid,timestamptz,jsonb,jsonb)'
const baseline = readFileSync(path.join(schemaRoot,
  'bootstrap/supabase/migrations/20261027000008_qa_baseline_008.sql'), 'utf8')
const capturedWrapper = baseline.slice(baseline.indexOf('CREATE FUNCTION public.accounting_update_purchase_items('))
  .split('$_$;')[0] + '$_$;'
const privateBaseline = readFileSync(path.join(schemaRoot,
  'bootstrap/supabase/migrations/20261027000005_qa_baseline_005.sql'), 'utf8')
const capturedPrivate = privateBaseline.slice(privateBaseline.indexOf('CREATE FUNCTION location_acl_private.original_4250037('))
  .split('$_$;')[0] + '$_$;'

const suite = postgresAvailable ? describe : describe.skip
suite('captured accounting wrapper OID compatibility in socket-only PostgreSQL', () => {
  const postgres = disposablePostgres()
  const db = postgres.db
  let publicOid: string
  let privateOid: string
  const metadata = () => db(`SELECT jsonb_agg(jsonb_build_object('oid',oid,'owner',proowner,
    'acl',proacl,'security',prosecdef,'config',proconfig) ORDER BY oid) FROM pg_proc
    WHERE oid IN (${publicOid},${privateOid});`)
  const items = () => JSON.parse(db(`SELECT jsonb_agg(jsonb_build_object('id',id,
    'catalog_item_id',catalog_item_id,'name',name,'quantity',quantity,'unit_cost',unit_cost))
    FROM public.purchase_items WHERE purchase_id='${ids.bill}';`))
  const edit = (input = items(), site = ids.site, bill = ids.bill) =>
    `SELECT public.accounting_update_purchase_items('${site}','${bill}',
    '${db(`SELECT updated_at FROM public.purchases WHERE id='${bill}';`)}',
    ${jsonSql(input)},'{"notes":"Header edited"}');`
  beforeAll(() => postgres.start(), 30000)
  afterAll(() => postgres.stop())
  beforeEach(() => {
    setupReviewDatabase(sql => sql === accountingFix ? '' : db(sql))
    publicOid = db(`SELECT 'public.accounting_update_purchase_items${signature}'::regprocedure::oid;`)
    expect(publicOid).not.toBe('4250037')
    privateOid = db(`SELECT 'location_acl_private.original_${publicOid}${signature}'::regprocedure::oid;`)
    db(`DO $restore$ DECLARE definition text; BEGIN
      definition := pg_get_functiondef(${publicOid});
      ALTER FUNCTION location_acl_private.original_${publicOid}${signature} RENAME TO original_4250037;
      EXECUTE replace(definition,'location_acl_private.original_${publicOid}(',
        'location_acl_private.original_4250037(');
    END $restore$;`)
    db(capturedPrivate.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION'))
    db(capturedWrapper.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION'))
  })

  it('reproduces the old failure, then runs the unchanged patch and preserves line identity', () => {
    const before = metadata()
    expect(() => db(accountingFix)).toThrow(/Unexpected accounting location wrapper/)
    db(compatibility)
    expect(metadata()).toBe(before)
    db(compatibility)
    expect(metadata()).toBe(before)
    expect(db(`SELECT to_regprocedure('location_acl_private.original_4250037${signature}') IS NULL;`)).toBe('t')
    db(accountingFix)
    db(actor(partialCall(1, uuid(810))))
    const lines = db('SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.purchase_items i;')
    db(actor(edit()))
    expect(db('SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.purchase_items i;')).toBe(lines)
    const changed = items(); changed[0].quantity = 99
    expect(() => db(actor(edit(changed)))).toThrow(/must remain unchanged/)
    const forged = items(); forged[0].id = uuid(999)
    expect(() => db(actor(edit(forged)))).toThrow(/identity must remain unchanged/)
    expect(metadata()).toBe(before)
  })

  it('retains restricted, anonymous, cross-site and actual private-call denial', () => {
    db(compatibility); db(accountingFix)
    db(`INSERT INTO public.site_member_location_restrictions VALUES
      ('${ids.site}','${receivers.memberRow}','${ids.hidden}');`)
    expect(() => db(actor(edit(), receivers.member))).toThrow(/no authorized location projection/)
    expect(() => db(actor(edit(), null, 'anon'))).toThrow(/permission denied/)
    expect(() => db(actor(edit(items(), ids.otherSite, ids.foreignBill)))).toThrow(/not authorized/)
    for (const role of ['authenticated', 'anon', 'service_role']) {
      expect(() => db(actor(`SELECT location_acl_private.original_${publicOid}
        ('${ids.site}','${ids.bill}',now(),'[]','{}');`, ids.owner, role))).toThrow(/permission denied/)
    }
  })

  it('rejects destination collisions atomically', () => {
    db(`CREATE FUNCTION location_acl_private.original_${publicOid}${signature}
      RETURNS void LANGUAGE sql AS $$ SELECT; $$;`)
    const before = metadata()
    expect(() => db(compatibility)).toThrow(/destination already exists/)
    expect(metadata()).toBe(before)
    expect(db(`SELECT proname FROM pg_proc WHERE oid=${privateOid};`)).toBe('original_4250037')
  })

  it('rejects a missing captured implementation without changing the public wrapper', () => {
    db(`DROP FUNCTION location_acl_private.original_4250037${signature};`)
    const before = db(`SELECT pg_get_functiondef(${publicOid});`)
    expect(() => db(compatibility)).toThrow(/implementation is missing/)
    expect(db(`SELECT pg_get_functiondef(${publicOid});`)).toBe(before)
  })

  it('rejects unexpected wrapper bodies and private execution grants without changes', () => {
    db(`GRANT EXECUTE ON FUNCTION location_acl_private.original_4250037${signature} TO authenticated;`)
    expect(() => db(compatibility)).toThrow(/execution grants/)
    db(`REVOKE EXECUTE ON FUNCTION location_acl_private.original_4250037${signature} FROM authenticated;
      CREATE OR REPLACE FUNCTION public.accounting_update_purchase_items(p_site_id uuid,
        p_purchase_id uuid,p_expected_updated_at timestamptz,p_items jsonb,p_update jsonb)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
      AS $$ BEGIN PERFORM public.location_acl_assert_unscoped_rpc(); RETURN; END $$;`)
    expect(() => db(compatibility)).toThrow(/Unexpected captured accounting wrapper/)
    expect(db(`SELECT proname FROM pg_proc WHERE oid=${privateOid};`)).toBe('original_4250037')
  })
})