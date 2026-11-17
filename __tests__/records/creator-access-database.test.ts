/** @jest-environment node */
import { readFileSync } from "node:fs"
import path from "node:path"
import { available, id, localDatabase } from "./trash-database-fixture"

const suite = available ? describe : describe.skip
const migration = readFileSync(path.join(process.cwd(),
  "supabase/migrations/20261117210000_records_creator_access.sql"), "utf8")

suite("record creator access in disposable PostgreSQL", () => {
  const pg = localDatabase()
  const insert = (title: string, site = 10) => `INSERT INTO records(site_id,title,relations)
    VALUES ('${id(site)}','${title}','{}') RETURNING title,created_by_user_id;`
  const visible = (who: number) => pg.actor("SELECT coalesce(string_agg(title,',' ORDER BY title),'') FROM records;", who)

  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop(), 30000)
  beforeEach(() => {
    pg.db(`DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
      CREATE SCHEMA public; CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      INSERT INTO auth.users SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
        FROM generate_series(1,8) n;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE TABLE sites(id uuid PRIMARY KEY,user_id uuid);
      INSERT INTO sites VALUES ('${id(10)}','${id(1)}'),('${id(11)}','${id(8)}');
      CREATE TABLE site_ownership(site_id uuid,user_id uuid);
      INSERT INTO site_ownership VALUES ('${id(10)}','${id(2)}');
      CREATE TABLE site_members(site_id uuid,user_id uuid,status text,restrict_to_assigned_only boolean,
        licensed boolean,can_insert boolean,location_restricted boolean DEFAULT false);
      INSERT INTO site_members VALUES
        ('${id(10)}','${id(3)}','active',true,true,true,false),
        ('${id(10)}','${id(4)}','active',false,true,true,false),
        ('${id(10)}','${id(5)}','inactive',true,true,true,false),
        ('${id(10)}','${id(6)}','active',true,false,true,false),
        ('${id(10)}','${id(7)}','active',true,true,false,false);
      CREATE FUNCTION user_can(s uuid,a text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path=public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM sites WHERE id=s AND user_id=auth.uid())
        OR EXISTS(SELECT 1 FROM site_ownership WHERE site_id=s AND user_id=auth.uid())
        OR EXISTS(SELECT 1 FROM site_members WHERE site_id=s AND user_id=auth.uid()
          AND status='active' AND licensed AND (a<>'insert' OR can_insert)) $$;
      CREATE FUNCTION can_access_record_values(s uuid,r jsonb) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path=public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM site_members WHERE site_id=s
          AND user_id=auth.uid() AND (NOT restrict_to_assigned_only OR r::text LIKE '%'||auth.uid()::text||'%')) $$;
      CREATE TABLE records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid,title text,relations jsonb,
        deleted_at timestamptz);
      INSERT INTO records(site_id,title,relations) VALUES
        ('${id(10)}','historical','{}'),
        ('${id(10)}','assigned','{"assignee":"${id(3)}"}'),
        ('${id(10)}','substring','{"note":"prefix-${id(3)}-suffix"}'),
        ('${id(10)}','key-only','{"${id(3)}":"other"}');
      ALTER TABLE records ENABLE ROW LEVEL SECURITY;
      CREATE POLICY records_select ON records FOR SELECT TO authenticated USING
        (user_can(site_id,'select') AND can_access_record_values(site_id,relations));
      CREATE POLICY records_insert ON records FOR INSERT TO authenticated WITH CHECK
        (user_can(site_id,'insert') AND can_access_record_values(site_id,relations));
      CREATE POLICY records_active_select ON records AS RESTRICTIVE FOR SELECT TO authenticated USING(deleted_at IS NULL);
      CREATE POLICY location_acl_enforcement ON records AS RESTRICTIVE TO authenticated USING
        (NOT EXISTS(SELECT 1 FROM site_members WHERE user_id=auth.uid() AND location_restricted));
      GRANT SELECT ON sites,site_ownership,site_members TO authenticated;
      GRANT SELECT,DELETE ON records TO authenticated;
      GRANT INSERT(site_id,title,relations),UPDATE(title,relations) ON records TO authenticated;
      GRANT ALL ON records TO service_role;`)
    // Reproduce the actual failure before applying the correction.
    expect(() => pg.actor(`INSERT INTO records(site_id,title,relations)
      VALUES('${id(10)}','before','{}') RETURNING title;`, 3)).toThrow(/row-level security/)
    pg.db(migration)
  })

  it("creates an empty draft under column grants and can read/update/delete it", () => {
    expect(pg.actor(insert("own"), 3)).toBe(`own|${id(3)}`)
    expect(visible(3)).toBe("assigned,own")
    expect(pg.actor("UPDATE records SET title='changed' WHERE title='own' RETURNING title;", 3)).toBe("changed")
    expect(pg.actor("DELETE FROM records WHERE title='changed' RETURNING title;", 3)).toBe("changed")
    expect(pg.db("SELECT count(*) FROM records WHERE created_by_user_id IS NOT NULL;")).toBe("0")
  })

  it("does not infer historical creators or accept UUID substrings/keys as assignment", () => {
    expect(visible(3)).toBe("assigned")
    expect(pg.db("SELECT count(*) FROM records WHERE created_by_user_id IS NULL;")).toBe("4")
  })

  it.each([1, 2, 4])("preserves site-wide access for owner/coowner/unrestricted actor %s", who => {
    expect(visible(who)).toBe("assigned,historical,key-only,substring")
    expect(pg.actor(insert("own"), who)).toBe(`own|${id(who)}`)
  })

  it.each([5, 6, 7, 8])("denies inactive/unlicensed/read-only/foreign actor %s creation", who => {
    expect(() => pg.actor(insert("denied"), who)).toThrow(/row-level security/)
  })

  it("denies cross-site creation and unauthenticated requests", () => {
    expect(() => pg.actor(insert("foreign", 11), 3)).toThrow(/row-level security/)
    expect(() => pg.db(`SET ROLE authenticated; SET request.jwt.claim.sub=''; ${insert("anonymous")}`))
      .toThrow(/authentication/)
    expect(() => pg.actor(insert("anon"), 3, "anon")).toThrow(/permission denied/)
  })

  it("keeps other creators hidden even with an additional permissive policy", () => {
    pg.actor(insert("other"), 4)
    pg.db("CREATE POLICY broad_select ON records FOR SELECT TO authenticated USING(true);")
    expect(visible(3)).toBe("assigned")
    expect(pg.actor("UPDATE records SET title='stolen' WHERE title='other' RETURNING title;", 3)).toBe("")
    expect(pg.actor("DELETE FROM records WHERE title='other' RETURNING title;", 3)).toBe("")
  })

  it("prevents forged creators and changes without expanding column grants", () => {
    expect(() => pg.actor(`INSERT INTO records(site_id,title,created_by_user_id)
      VALUES('${id(10)}','forged','${id(4)}');`, 3)).toThrow(/permission denied/)
    // Temporarily broaden fixture grants to exercise the trigger's defense in depth.
    pg.db("GRANT INSERT(created_by_user_id),UPDATE(created_by_user_id) ON records TO authenticated;")
    expect(() => pg.actor(`INSERT INTO records(site_id,title,created_by_user_id)
      VALUES('${id(10)}','forged','${id(4)}');`, 3)).toThrow(/must match the actor/)
    pg.actor(insert("own"), 3)
    expect(() => pg.actor(`UPDATE records SET created_by_user_id='${id(4)}' WHERE title='own';`, 3))
      .toThrow(/immutable/)
    expect(() => pg.db(`UPDATE records SET created_by_user_id='${id(3)}' WHERE title='historical';`))
      .toThrow(/immutable/)
  })

  it("allows verified service attribution at insertion but does not infer an actor", () => {
    expect(pg.db(`SET ROLE service_role; SET request.jwt.claim.sub='';
      INSERT INTO records(site_id,title,relations) VALUES('${id(10)}','unknown','{}')
      RETURNING coalesce(created_by_user_id::text,'unknown');`)).toBe("unknown")
    expect(pg.db(`SET ROLE service_role; SET request.jwt.claim.sub='';
      INSERT INTO records(site_id,title,relations,created_by_user_id)
      VALUES('${id(10)}','verified','{}','${id(3)}') RETURNING title;`)).toBe("verified")
    expect(visible(3)).toBe("assigned,verified")
    expect(() => pg.actor(`UPDATE records SET created_by_user_id='${id(4)}' WHERE title='verified';`,
      3, "service_role")).toThrow(/immutable/)
  })

  it("retains location and trash restrictions", () => {
    pg.actor(insert("own"), 3)
    pg.db("UPDATE records SET deleted_at=now() WHERE title='own';")
    expect(visible(3)).toBe("assigned")
    pg.db(`UPDATE site_members SET location_restricted=true WHERE user_id='${id(3)}';`)
    expect(visible(3)).toBe("")
    expect(() => pg.actor(insert("blocked"), 3)).toThrow(/row-level security/)
  })
})