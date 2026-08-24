import {
  DEFAULT_STEP_ROLE,
  normalizeValidationRules,
  roleFromSkill,
} from "@/app/components/workflows/types"

describe("roleFromSkill", () => {
  it("maps role skills to the matching role", () => {
    expect(roleFromSkill("makinari-rol-qa")).toBe("qa")
    expect(roleFromSkill("makinari-rol-frontend")).toBe("frontend")
    expect(roleFromSkill("makinari-rol-orchestrator")).toBe("orchestrator")
  })

  it("uses assistant for the default workflow skill and task objective", () => {
    expect(roleFromSkill()).toBe(DEFAULT_STEP_ROLE)
    expect(roleFromSkill("makinari-rol-workflow-step")).toBe("assistant")
    expect(roleFromSkill("makinari-obj-tarea")).toBe("assistant")
  })

  it("keeps general as general", () => {
    expect(roleFromSkill("general")).toBe("general")
  })
})

describe("normalizeValidationRules", () => {
  it("accepts strings and schema objects", () => {
    expect(
      normalizeValidationRules([
        "npm run build returns 0",
        { rule: "preview_url", required: true },
        { rule: "cycle_id", value: "123" },
      ]),
    ).toEqual([
      { rule: "npm run build returns 0" },
      { rule: "preview_url", required: true },
      { rule: "cycle_id", value: "123" },
    ])
  })

  it("keeps draft rules that only set required", () => {
    expect(normalizeValidationRules([{ rule: "", required: true }])).toEqual([{ rule: "", required: true }])
  })

  it("drops empty noise", () => {
    expect(normalizeValidationRules(["", {}, null, { name: "repo_url", required: true }])).toEqual([
      { rule: "repo_url", required: true },
    ])
  })
})
