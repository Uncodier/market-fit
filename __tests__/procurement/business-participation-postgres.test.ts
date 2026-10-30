/** @jest-environment node */
import { actorSql, isolatedPostgres, migration, postgresAvailable } from '../security/isolated-postgres'
import { installEvidenceFixture, ids, uuid, supplierId, quoteDocument, sqlJson, metadata, upload } from './evidence-fixture'
import { publicationId, tenderId, requirementId, approve, openAward } from './commerce-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
const forward = '20261030140000_procurement_open_business_participation.sql'

describePg('open business participation on isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    installEvidenceFixture(pg, true)
    // Use the actual canonical license/role functions, with synthetic plan data.
    pg.db(`CREATE TABLE site_members(id uuid DEFAULT gen_random_uuid(), site_id uuid REFERENCES sites,
      user_id uuid,role text,status text,manually_disabled boolean NOT NULL DEFAULT false,created_at timestamptz DEFAULT now());
      CREATE TABLE site_ownership(site_id uuid,user_id uuid);
      INSERT INTO site_members(site_id,user_id,role,status)
       SELECT site_id,user_id,role,CASE WHEN active THEN 'active' ELSE 'inactive' END FROM fixture_members;
      ALTER TABLE sites ADD COLUMN test_plan text DEFAULT 'engine', ADD COLUMN name text DEFAULT 'Buyer business';
      CREATE FUNCTION effective_site_plan(p_site uuid) RETURNS text LANGUAGE sql STABLE AS
       $$ SELECT test_plan FROM sites WHERE id=p_site $$;
      UPDATE sites SET name='Owned business' WHERE id='${ids.otherSite}';
      INSERT INTO site_members(site_id,user_id,role,status) VALUES
       ('${ids.otherSite}','${ids.admin}','marketing','active'),
       ('${ids.otherSite}','${ids.inactive}','admin','pending');`)
    const canonical = migration('20261019220003_startup_trial_licensing.sql')
    for (const signature of ['site_member_has_effective_license(p_member_id uuid)', 'current_user_site_role(p_site_id uuid)']) {
      const start = canonical.indexOf(`FUNCTION public.${signature}`)
      pg.db('CREATE OR REPLACE ' + canonical.slice(start).split('$$;')[0] + '$$;')
    }
    for (const file of ['20261028001000_procurement_approval_revalidation.sql',
      '20261028020000_procurement_lifecycle_repair.sql', '20261028020001_procurement_commerce_lifecycle_repair.sql',
      '20261030120000_procurement_open_self_participation.sql', '20261030130000_procurement_proposal_attachments.sql', forward,
      '20261030190000_procurement_free_text_quotations.sql']) pg.db(migration(file))
    pg.db(`GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
      DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP
      EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature); END LOOP; END $$;`)
    pg.call(`SELECT configure_procurement_tender_portal('${ids.site}',true);`)
    amend(`UPDATE procurement_tenders SET visibility='public',participation='open' WHERE id='${tenderId}';
      UPDATE procurement_tender_publications SET visibility='public',snapshot=jsonb_set(snapshot,'{participation}','"open"') WHERE id='${publicationId}';
      UPDATE procurement_tender_policy_bindings SET working_snapshot=(SELECT to_jsonb(t)-ARRAY['status','updated_at','version'] FROM procurement_tenders t WHERE id='${tenderId}');`)
  })
  const amend = (sql: string) => pg.db(`SET session_replication_role=replica; ${sql} SET session_replication_role=origin;`)
  const registration = (site = ids.otherSite, publication = publicationId) => `SELECT register_open_tender_business('${publication}','${site}');`
  const register = (actor = ids.foreign, site = ids.otherSite) => pg.call(registration(site), actor)
  const submit = (supplier: string, extra = {}, actor = ids.foreign) => pg.call(
    `SELECT submit_procurement_quotation('${ids.site}',${sqlJson({ ...quoteDocument, supplier_id: supplier, ...extra })});`, actor)
  const opportunities = (actor = ids.foreign): Record<string, unknown>[] => JSON.parse(pg.call('SELECT my_procurement_participation();', actor))
  const businessChoices = (actor = ids.foreign) => opportunities(actor).filter(o => o.acting_site_id)

  test('business registration submits a net-only free-text offer without claiming a catalog item', () => {
    amend(`UPDATE procurement_tenders SET requirements=jsonb_set(requirements,'{0,catalog_item_id}','null') WHERE id='${tenderId}';`)
    const business = register()
    const quote = submit(business)
    expect(submit(business)).toBe(quote)
    expect(pg.db(`SELECT procurement_tax_minor IS NULL AND total IS NULL FROM quotations WHERE id='${quote}';`)).toBe('t')
    expect(pg.db(`SELECT catalog_item_id IS NULL FROM quotation_items WHERE quotation_id='${quote}';`)).toBe('t')
  })

  test('safe exact DTO includes owned and active member businesses, without approval or claimed identity', () => {
    const choice = businessChoices()[0]
    expect(businessChoices()).toHaveLength(1)
    expect(choice).toMatchObject({ site_id: ids.site, acting_site_id: ids.otherSite, acting_as_self: false,
      supplier_id: null, supplier_name: 'Owned business', publication_id: publicationId })
    expect(Object.keys(choice).sort()).toEqual(['site_id', 'supplier_id', 'supplier_name', 'acting_as_self', 'acting_site_id',
      'tender_id', 'publication_id', 'version', 'title', 'description', 'currency', 'participation_deadline',
      'opening_at', 'opening_policy', 'requirements'].sort())
    expect(choice.requirements).toEqual([{ id: requirementId, description: 'Equipment', quantity: 2, unit: 'each' }])
    expect(businessChoices(ids.admin).map(o => o.acting_site_id)).toContain(ids.otherSite)
    const business = register()
    expect(business).not.toBe(supplierId)
    expect(businessChoices()[0].supplier_id).toBe(business)
    expect(register(ids.admin)).toBe(business)
    expect(pg.db(`SELECT status FROM suppliers WHERE id='${business}';`)).toBe('prospect')
    expect(pg.db('SELECT count(*) FROM supplier_representatives;')).toBe('0')
    expect(pg.call(`SELECT procurement_can_represent('${ids.site}','${business}');`, ids.foreign)).toBe('f')
    expect(submit(business)).toBeTruthy()
  })

  test('owner access is independent of seats; pending, inactive, manually disabled and unlicensed memberships fail', () => {
    expect(() => register(ids.inactive)).toThrow(/Business participation denied/)
    expect(businessChoices(ids.inactive)).toEqual([])
    expect(() => register(ids.owner)).toThrow(/Business participation denied/)
    expect(() => register(ids.foreign, uuid(999))).toThrow(/Business participation denied/)
    expect(pg.call(`SELECT current_user_site_role('${ids.otherSite}');`, ids.admin)).toBe('marketing')
    const business = register(ids.admin)
    for (const change of ["status='inactive'", "status='pending'", "status='active',manually_disabled=true"]) {
      pg.db(`UPDATE site_members SET ${change} WHERE site_id='${ids.otherSite}' AND user_id='${ids.admin}';`)
      expect(businessChoices(ids.admin).map(o => o.acting_site_id)).not.toContain(ids.otherSite)
      expect(() => register(ids.admin)).toThrow(/Business participation denied/)
      expect(() => submit(business, {}, ids.admin)).toThrow(/Business participation denied/)
    }
    pg.db(`UPDATE site_members SET status='active',manually_disabled=false WHERE user_id='${ids.admin}';
      UPDATE sites SET test_plan='starter' WHERE id='${ids.otherSite}';`)
    expect(pg.call(`SELECT current_user_site_role('${ids.otherSite}');`, ids.admin)).toBe('')
    expect(() => submit(business, {}, ids.admin)).toThrow(/Business participation denied/)
    expect(register()).toBe(business)
    expect(submit(business)).toBeTruthy()
  })

  test('submission rechecks removal, archive, owner transfer, publication scope and arbitrary supplier identities', () => {
    const business = register()
    expect(() => submit(supplierId)).toThrow(/representation required/)
    expect(() => submit(business, { publication_id: uuid(990) })).toThrow(/Business participation denied/)
    pg.db(`DELETE FROM site_members WHERE site_id='${ids.otherSite}' AND user_id='${ids.admin}';`)
    expect(() => submit(business, {}, ids.admin)).toThrow(/Business participation denied/)
    pg.db(`UPDATE sites SET user_id='${ids.owner}' WHERE id='${ids.otherSite}';`)
    expect(() => submit(business)).toThrow(/Business participation denied/)
    pg.db(`UPDATE sites SET user_id='${ids.foreign}',archived_at=now() WHERE id='${ids.otherSite}';`)
    expect(() => register()).toThrow(/Business participation denied/)
    expect(() => submit(business)).toThrow(/Business participation denied/)
    expect(businessChoices()).toEqual([])
  })

  test.each(['private', 'approved_suppliers', 'invitation_only', 'expired', 'disabled', 'unconfirmed', 'buyer_archived', 'stale', 'closed'])(
    'registration rejects %s and discovery omits business opportunities', mode => {
      if (mode === 'private') amend("UPDATE procurement_tender_publications SET visibility='private';")
      else if (['approved_suppliers', 'invitation_only'].includes(mode)) amend(`UPDATE procurement_tender_publications SET snapshot=jsonb_set(snapshot,'{participation}',to_jsonb('${mode}'::text));`)
      else if (mode === 'expired') amend(`UPDATE procurement_tender_publications SET snapshot=jsonb_set(snapshot,'{participation_deadline}',to_jsonb((now()-interval '1 day')::text));`)
      else if (mode === 'disabled') pg.call(`SELECT configure_procurement_tender_portal('${ids.site}',false);`)
      else if (mode === 'unconfirmed') pg.db(`UPDATE auth.users SET email_confirmed_at=NULL WHERE id='${ids.foreign}';`)
      else if (mode === 'buyer_archived') pg.db(`UPDATE sites SET archived_at=now() WHERE id='${ids.site}';`)
      else if (mode === 'stale') amend('UPDATE procurement_tenders SET version=version+1;')
      else amend("UPDATE procurement_tenders SET status='closed';")
      expect(() => register()).toThrow(/required/)
      expect(businessChoices()).toEqual([])
    })

  test('blocked supplier is hidden and denied without creating a replacement', () => {
    const business = register()
    pg.db(`SET request.jwt.claims='{"sub":"${ids.owner}"}'; UPDATE suppliers SET status='blocked',version=version+1 WHERE id='${business}';`)
    expect(businessChoices()).toEqual([])
    expect(() => register()).toThrow(/Business participation unavailable/)
    expect(() => submit(business)).toThrow(/Business participation denied/)
    expect(pg.db('SELECT count(*) FROM procurement_open_business_registrations;')).toBe('1')
  })

  test('each new publication gets a fresh identity and cannot reuse the previous registration', () => {
    const first = register()
    amend(`UPDATE procurement_tenders SET version=2 WHERE id='${tenderId}';
      INSERT INTO procurement_tender_publications(id,site_id,tender_id,version,visibility,global_visible,published_by,policy_revision,snapshot)
       SELECT '${uuid(991)}',site_id,tender_id,2,visibility,global_visible,published_by,policy_revision,snapshot
        FROM procurement_tender_publications WHERE id='${publicationId}';`)
    expect(businessChoices()[0]).toMatchObject({ supplier_id: null, publication_id: uuid(991) })
    expect(() => register()).toThrow(/Open public tender required/)
    expect(() => submit(first, { publication_id: uuid(991) })).toThrow(/Business participation denied/)
    const second = pg.call(registration(ids.otherSite, uuid(991)), ids.foreign)
    expect(second).not.toBe(first)
    expect(businessChoices()[0].supplier_id).toBe(second)
  })

  test('later supplier approval/representation cannot bypass business membership revocation, even on exact retries', () => {
    const business = register(ids.admin)
    submit(business, {}, ids.admin)
    pg.db(`SET request.jwt.claims='{"sub":"${ids.owner}"}'; UPDATE suppliers SET status='approved',version=version+1 WHERE id='${business}';`)
    pg.call(`SELECT set_supplier_representative('${ids.site}','${business}','${ids.admin}',false);`)
    pg.db(`DELETE FROM site_members WHERE site_id='${ids.otherSite}' AND user_id='${ids.admin}';`)
    expect(() => submit(business, {}, ids.admin)).toThrow(/Business participation denied/)
    expect(opportunities(ids.admin).map(o => o.supplier_id)).not.toContain(business)
  })

  test('business submissions retain private evidence, PDF proposals, receipt custody and post-close award/order flow', () => {
    const business = register()
    const evidence = upload(pg)
    const proposal = JSON.parse(pg.call(`SELECT reserve_procurement_credential(NULL,0,
      ${sqlJson({ ...metadata, type: 'tender_proposal' })},'proposal.pdf','application/pdf',10);`, ids.foreign))
    pg.call(`INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('procurement-credentials','${proposal.object_path}','{"size":10,"mimetype":"application/pdf"}');
      SELECT complete_procurement_credential('${proposal.revision_id}');`, ids.foreign)
    const extra = { evidence: [{ requirement_id: requirementId, revision_id: evidence.revision_id }], proposal_revision_id: proposal.revision_id }
    expect(() => submit(business, extra, ids.admin)).toThrow(/Private evidence unavailable/)
    const quote = submit(business, extra)
    expect(submit(business, extra)).toBe(quote)
    expect(pg.call('SELECT count(*) FROM procurement_quotation_attachments;')).toBe('0')
    expect(pg.call('SELECT count(*) FROM procurement_submission_evidence;')).toBe('0')
    expect(pg.call('SELECT count(*) FROM procurement_quotation_attachments;', ids.admin)).toBe('0')
    openAward(pg)
    expect(submit(business, extra)).toBe(quote)
    expect(pg.call('SELECT count(*) FROM procurement_quotation_attachments;')).toBe('1')
    expect(pg.call('SELECT count(*) FROM procurement_submission_evidence;')).toBe('1')
    pg.call(approve(quote, 'award'), ids.owner, 'service_role')
    const award = pg.db(`SELECT id FROM procurement_awards WHERE quotation_id='${quote}';`)
    pg.call(approve(award, 'order'), ids.owner, 'service_role')
    expect(pg.db(`SELECT count(*) FROM purchase_orders WHERE supplier_id='${business}';`)).toBe('1')
    expect(pg.db(`SELECT status FROM suppliers WHERE id='${business}';`)).toBe('prospect')
  })

  test('self identity and approved representative behavior remain separate', () => {
    const business = register()
    const self = pg.call(`SELECT register_open_tender_participant('${publicationId}');`, ids.foreign)
    expect(self).not.toBe(business)
    expect(submit(self)).toBeTruthy()
    pg.call(`SELECT set_supplier_representative('${ids.site}','${supplierId}','${ids.foreign}',false);`)
    expect(opportunities().find(o => o.supplier_id === supplierId)).toMatchObject({ acting_as_self: false, acting_site_id: null })
    expect(submit(supplierId, { idempotency_key: uuid(977) })).toBeTruthy()
    expect(opportunities().find(o => o.acting_as_self)).toMatchObject({ acting_site_id: null, supplier_id: self })
  })

  test('concurrent member/owner registrations converge; internal helpers and writes are denied', async () => {
    const results = await Promise.all([pg.concurrent(actorSql(registration(), ids.foreign)), pg.concurrent(actorSql(registration(), ids.admin))])
    expect(results[0]).toBe(results[1])
    expect(pg.db('SELECT count(*) FROM procurement_open_business_registrations;')).toBe('1')
    expect(() => pg.call(registration(), ids.foreign, 'anon')).toThrow(/permission denied/)
    expect(() => pg.call(registration(), ids.foreign, 'service_role')).toThrow(/permission denied/)
    expect(() => pg.call(`SELECT procurement_business_access('${ids.otherSite}','${ids.foreign}');`, ids.foreign)).toThrow(/permission denied/)
    expect(() => pg.call('SELECT * FROM procurement_open_business_registrations;', ids.foreign)).toThrow(/permission denied/)
    expect(() => pg.call('DELETE FROM procurement_open_business_registrations;', ids.foreign)).toThrow(/permission denied/)
    expect(() => pg.db('DELETE FROM procurement_open_business_registrations;')).toThrow(/immutable/)
  })
})