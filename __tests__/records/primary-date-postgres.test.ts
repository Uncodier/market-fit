/** @jest-environment node */
import { isolatedPostgres, migration, postgresAvailable } from "../security/isolated-postgres"

const sql = migration("20261126001000_records_primary_date.sql")
const fields = `[{"id":"day","name":"Day","type":"date"},{"id":"count","name":"Count","type":"number"}]`

;(postgresAvailable ? describe : describe.skip)("category primary date migration", () => {
  const { db, start, stop } = isolatedPostgres()

  beforeAll(() => {
    start()
    db(`CREATE TABLE public.record_categories (id integer PRIMARY KEY, template_fields jsonb);
      INSERT INTO public.record_categories VALUES (1, '${fields}'), (2, NULL);
      ALTER TABLE public.record_categories ENABLE ROW LEVEL SECURITY;
      CREATE POLICY category_scope ON public.record_categories TO authenticated USING (id = 1) WITH CHECK (id = 1);
      GRANT SELECT, INSERT (id, template_fields), UPDATE (template_fields) ON public.record_categories TO authenticated;`)
    db(sql)
  })
  afterAll(stop)

  it("leaves historical categories unset and permits saving on an accessible category", () => {
    expect(db("SELECT count(*) FROM record_categories WHERE primary_date_field_id IS NULL;")).toBe("2")
    expect(db(`SET ROLE authenticated;
      UPDATE record_categories SET primary_date_field_id = 'day' WHERE id = 1 RETURNING primary_date_field_id;`)).toBe("day")
  })

  it("rejects unknown and non-date fields, and cannot orphan the setting", () => {
    for (const invalid of ["missing", "count"]) {
      expect(() => db(`SET ROLE authenticated; UPDATE record_categories SET primary_date_field_id = '${invalid}' WHERE id = 1;`))
        .toThrow(/record_categories_primary_date_field_check/)
    }
    expect(() => db("UPDATE record_categories SET primary_date_field_id = 'day' WHERE id = 2;"))
      .toThrow(/record_categories_primary_date_field_check/)
    db("UPDATE record_categories SET primary_date_field_id = 'day' WHERE id = 1;")
    expect(() => db("SET ROLE authenticated; UPDATE record_categories SET template_fields = '[]' WHERE id = 1;"))
      .toThrow(/record_categories_primary_date_field_check/)
    db("SET ROLE authenticated; UPDATE record_categories SET template_fields = '[]', primary_date_field_id = NULL WHERE id = 1;")
  })

  it("preserves the existing row and role restrictions", () => {
    expect(db(`SET ROLE authenticated; UPDATE record_categories SET primary_date_field_id = NULL WHERE id = 2 RETURNING id;`)).toBe("")
    expect(db("SELECT has_column_privilege('anon', 'record_categories', 'primary_date_field_id', 'UPDATE');")).toBe("f")
  })

  it("allows defining the date when creating an authorized category", () => {
    db("DELETE FROM record_categories WHERE id = 1;")
    expect(db(`SET ROLE authenticated;
      INSERT INTO record_categories (id, template_fields, primary_date_field_id) VALUES (1, '${fields}', 'day')
      RETURNING primary_date_field_id;`)).toBe("day")
  })
})