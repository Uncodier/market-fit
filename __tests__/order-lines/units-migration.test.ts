/** @jest-environment node */

import { readFileSync } from "node:fs"
import { join } from "node:path"

const unitsMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260921143000_create_sale_order_item_units.sql",
  ),
  "utf8",
)
const securityMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260921151500_secure_order_line_unit_mutations.sql",
  ),
  "utf8",
)
const milestonesMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260921151600_add_order_line_unit_milestones.sql",
  ),
  "utf8",
)
const hardeningMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260921153000_harden_order_line_workflow.sql",
  ),
  "utf8",
)

describe("order-line operational units migration", () => {
  it("creates one independently actionable record per item unit", () => {
    expect(unitsMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.sale_order_item_units",
    )
    expect(unitsMigration).toContain(
      "UNIQUE (sale_order_item_id, unit_index)",
    )
    expect(unitsMigration).toContain(
      "generate_series(1, unit_count.value)",
    )
  })

  it("stores status and employee assignment on each unit", () => {
    expect(unitsMigration).toContain("assigned_to uuid")
    expect(unitsMigration).toContain("status text NOT NULL")
    expect(securityMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.mutate_sale_order_item_units",
    )
    expect(securityMigration).toContain("GRANT EXECUTE ON FUNCTION")
    expect(securityMigration).toContain(
      "REVOKE ALL ON TABLE public.sale_order_item_units FROM anon, authenticated",
    )
    expect(securityMigration).toContain("member.status = 'active'")
    expect(securityMigration).toContain("restrict_to_assigned_only")
  })

  it("keeps future item quantities synchronized", () => {
    expect(unitsMigration).toContain(
      "sync_sale_order_item_units_after_insert",
    )
    expect(unitsMigration).toContain(
      "sync_sale_order_item_units_after_update",
    )
  })

  it("advances a selected batch in one database statement", () => {
    expect(hardeningMigration).toContain("ELSIF p_operation = 'advance'")
    expect(hardeningMigration).toContain(
      "SET status = transitions ->> id::text",
    )
    expect(hardeningMigration).toContain("FOR UPDATE")
    expect(hardeningMigration).toContain(
      "'owner',\n        'admin',\n        'collaborator'",
    )
    expect(hardeningMigration).toContain(
      "authorize_order_item_unit_sync_before_update",
    )
    expect(hardeningMigration).toContain(
      "authorize_order_item_unit_sync_before_delete",
    )
    expect(hardeningMigration).toContain(
      "prevent_cancelled_order_reopen_before_update",
    )
    expect(hardeningMigration).toContain(
      "sync_sale_order_item_status_from_units",
    )
    expect(hardeningMigration).toContain(
      "DROP CONSTRAINT IF EXISTS sale_order_items_status_check",
    )
  })

  it("persists production, ready, and delivery milestones", () => {
    expect(milestonesMigration).toContain(
      "ADD COLUMN IF NOT EXISTS in_progress_at timestamptz",
    )
    expect(milestonesMigration).toContain(
      "ADD COLUMN IF NOT EXISTS ready_at timestamptz",
    )
    expect(milestonesMigration).toContain(
      "ADD COLUMN IF NOT EXISTS delivered_at timestamptz",
    )
    expect(milestonesMigration).toContain(
      "sync_order_line_unit_delivery_after_update",
    )
    expect(milestonesMigration).toContain(
      "sync_order_lines_from_order_status_after_update",
    )
    expect(hardeningMigration).toContain(
      "NEW.status IN ('pending', 'in_progress', 'completed', 'cancelled')",
    )
    expect(hardeningMigration).toContain("parent_sale_order_item_id")
  })
})
