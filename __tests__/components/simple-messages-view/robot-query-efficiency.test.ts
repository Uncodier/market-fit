/** @jest-environment node */

import { readFileSync } from "node:fs"
import { join } from "node:path"

const readSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8")

describe("robot workspace query efficiency", () => {
  it("uses stable keyset pagination for instance logs", () => {
    const source = readSource(
      "app/components/simple-messages-view/hooks/useInstanceLogs.ts"
    )

    expect(source).toContain(".order('id', { ascending: false })")
    expect(source).toContain(
      "logs.find((log) => INSTANCE_LOG_ID_PATTERN.test(log.id))"
    )
    expect(source).toContain("created_at.lt.${oldestLogTime}")
    expect(source).toContain("id.lt.${oldestLogId}")
    expect(source).not.toContain("const oldestLogId = logs[0].id")
    expect(source).not.toContain(".from('instance_logs')\n        .select('*')")
  })

  it("loads the latest requirement backlog separately from status history", () => {
    const source = readSource(
      "app/components/simple-messages-view/hooks/useRequirementStatus.ts"
    )

    expect(source).toContain('"requirements(id, title)"')
    expect(source).toContain('.select("id, title, backlog")')
    expect(source).not.toContain("requirements(id, title, backlog)")
  })

  it("keys plan loading and subscriptions by stable instance ID", () => {
    const source = readSource(
      "app/components/simple-messages-view/hooks/useInstancePlans.ts"
    )

    expect(source).toContain("const instanceId = activeRobotInstance?.id")
    expect(source).toContain("}, [instanceId])")
    expect(source).not.toContain("}, [activeRobotInstance])")
  })
})
