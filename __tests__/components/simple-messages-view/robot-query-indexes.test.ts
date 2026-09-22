/** @jest-environment node */

import { readFileSync } from "node:fs"
import { join } from "node:path"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260922151000_optimize_robot_timeline_queries.sql"
  ),
  "utf8"
)

describe("robot timeline query indexes", () => {
  it("supports ordered instance status queries without indexing the large log table", () => {
    expect(migration).toContain(
      "requirement_status (instance_id, created_at ASC, id ASC)"
    )
    expect(migration).not.toContain("instance_logs")
  })
})
