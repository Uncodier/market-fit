import { readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const schemaMigration = readFileSync(
  path.join(root, "supabase/migrations/20260916020500_record_diagrams.sql"),
  "utf8"
)
const retrievalMigration = readFileSync(
  path.join(root, "supabase/migrations/20260916020600_record_diagram_retrieval.sql"),
  "utf8"
)
const accessMigration = readFileSync(
  path.join(root, "supabase/migrations/20260916020700_records_access_hardening.sql"),
  "utf8"
)
const relationshipCleanupMigration = readFileSync(
  path.join(root, "supabase/migrations/20260916020800_remove_redundant_record_category_fk.sql"),
  "utf8"
)
const nodeKindsMigration = readFileSync(
  path.join(root, "supabase/migrations/20260916020900_expand_record_diagram_node_kinds.sql"),
  "utf8"
)

describe("record diagram migration security", () => {
  it("does not use current_user to identify a SECURITY DEFINER caller", () => {
    expect(retrievalMigration).not.toContain("current_user <> 'service_role'")
  })

  it("keeps diagram writes and mutation RPCs service-only", () => {
    expect(schemaMigration).toContain(
      "REVOKE ALL ON public.record_diagrams, public.record_diagram_nodes"
    )
    expect(schemaMigration).toContain(
      "FROM PUBLIC, anon, authenticated;\nGRANT EXECUTE ON FUNCTION public.save_record_diagram"
    )
    expect(schemaMigration).not.toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON public.record_diagrams TO authenticated"
    )
  })

  it("installs command-specific records policies and tenant-consistent keys", () => {
    expect(accessMigration).toContain("CREATE POLICY records_select")
    expect(accessMigration).toContain("CREATE POLICY records_delete")
    expect(accessMigration).toContain("public.user_can(site_id, 'delete')")
    expect(accessMigration).toContain("FOREIGN KEY (record_id, site_id)")
    expect(accessMigration).toContain("DROP CONSTRAINT IF EXISTS records_category_id_fkey")
    expect(relationshipCleanupMigration).toContain(
      "DROP CONSTRAINT IF EXISTS records_category_id_fkey"
    )
  })

  it("queues record semantic changes for durable embedding processing", () => {
    expect(schemaMigration).toContain("record_embedding_revision")
    expect(retrievalMigration).toContain("queue_record_embedding_on_record_change")
    expect(retrievalMigration).toContain("enqueue_record_embedding_job")
    expect(retrievalMigration).toContain("p_record_revision")
  })

  it("supports standard diagram node types", () => {
    expect(nodeKindsMigration).toContain("'process', 'data', 'database', 'terminator'")
    expect(nodeKindsMigration).toContain("DROP CONSTRAINT IF EXISTS record_diagram_nodes_kind_check")
  })
})
