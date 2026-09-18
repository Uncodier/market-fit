/** @jest-environment node */

import fs from "node:fs"
import path from "node:path"
import { parse } from "yaml"

const CRUD_JOURNEYS = [
  "crud-catalog.test.yaml",
  "crud-requirement.test.yaml",
  "crud-record.test.yaml",
  "crud-content.test.yaml",
  "crud-promotion.test.yaml",
  "crud-lead.test.yaml",
  "crud-sale.test.yaml",
]

function readJourney(fileName: string): string {
  return fs.readFileSync(path.join(process.cwd(), "tests", fileName), "utf8")
}

type JourneyStep = {
  action?: string
  description?: string
  intent?: string
  js?: string
  locator?: string
  value?: string
  VERIFY?: string
  WAIT_UNTIL?: string
  THEN?: JourneyStep[]
  [key: string]: unknown
}

type Journey = {
  goal?: string
  statements?: JourneyStep[]
  teardown?: JourneyStep[]
}

function parseJourney(fileName: string): Journey {
  return parse(readJourney(fileName)) as Journey
}

function flattenSteps(steps: JourneyStep[]): JourneyStep[] {
  return steps.flatMap((step) => [
    step,
    ...(Array.isArray(step.THEN) ? flattenSteps(step.THEN) : []),
  ])
}

function stepText(step: JourneyStep): string {
  return [
    step.description,
    step.intent,
    step.js,
    step.locator,
    step.value,
    step.VERIFY,
    step.WAIT_UNTIL,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
}

describe("deterministic CRUD journeys", () => {
  it.each(CRUD_JOURNEYS)(
    "%s parses and has run-scoped setup and actionable teardown",
    (fileName) => {
      const journey = parseJourney(fileName)
      const statements = journey.statements ?? []
      const teardown = journey.teardown ?? []
      const statementText = flattenSteps(statements).map(stepText).join("\n")
      const teardownSteps = flattenSteps(teardown)
      const teardownText = teardownSteps.map(stepText).join("\n")

      expect(statements.length).toBeGreaterThan(0)
      expect(statementText).toContain("TEST_SITE_NAME is required")
      expect(statementText).toContain("Date.now()")
      expect(teardown.length).toBeGreaterThan(0)
      expect(teardownText).toMatch(/run-scoped|CleanupName|NeedsCleanup|Url/)
      expect(
        teardownSteps.some(
          (step) =>
            step.action === "click" ||
            (typeof step.js === "string" && /\.(?:click|goto)\(/.test(step.js)),
        ),
      ).toBe(true)
      expect(statementText).not.toMatch(
        /siteName\s*\?\s*[\s\S]*getByRole\('button', \{ name: 'Select' \}\)\.first\(\)/
      )
    }
  )

  it.each(CRUD_JOURNEYS)(
    "%s performs a non-empty update and verifies it after reload",
    (fileName) => {
      const statements = parseJourney(fileName).statements ?? []
      const updateStep = statements.find(
        (step) =>
          step.action === "fill" &&
          /update|replace/i.test(`${step.intent ?? ""} ${step.description ?? ""}`) &&
          typeof step.value === "string" &&
          step.value.trim().length > 0,
      )
      const saveStep = statements.find(
        (step) =>
          (step.action === "click" || step.action === "press") &&
          /save|update sale/i.test(stepText(step)),
      )
      const reloadStep = statements.find(
        (step) => typeof step.js === "string" && /page\.reload\(\)/.test(step.js),
      )
      const persistenceCheck = statements.find(
        (step) =>
          typeof step.VERIFY === "string" &&
          /persist(?:s|ence)? after reload/i.test(step.VERIFY),
      )

      expect(updateStep).toBeDefined()
      expect(saveStep).toBeDefined()
      expect(reloadStep).toBeDefined()
      expect(persistenceCheck).toBeDefined()
    },
  )

  it.each(CRUD_JOURNEYS)(
    "%s waits for loaded list data before absence assertions",
    (fileName) => {
      const statements = parseJourney(fileName).statements ?? []
      const absenceIndexes = statements
        .map((step, index) => ({ index, label: step.VERIFY }))
        .filter(({ label }) => typeof label === "string" && /absent/i.test(label))

      expect(absenceIndexes.length).toBeGreaterThan(0)
      for (const { index } of absenceIndexes) {
        const readinessStep = statements[index - 1]
        expect(readinessStep?.WAIT_UNTIL).toMatch(/finished loading/i)
        expect(readinessStep?.js).toContain("animate-pulse:visible")
      }
    },
  )

  it.each([
    ["crud-catalog.test.yaml", "TEST_CATALOG_CATEGORY_NAME"],
    ["crud-record.test.yaml", "TEST_RECORD_CATEGORY_NAME"],
    ["crud-promotion.test.yaml", "TEST_CAMPAIGN_NAME"],
  ])("%s uses a configured reusable dependency", (fileName, variableName) => {
    expect(readJourney(fileName)).toContain(`${variableName} is required`)
  })

  it("never falls back to a generic record for teardown", () => {
    const source = readJourney("crud-record.test.yaml")
    expect(source).not.toContain("Untitled Record")
  })

  it("describes catalog removal as archival and verifies archived state", () => {
    const journey = parseJourney("crud-catalog.test.yaml")
    const statementText = flattenSteps(journey.statements ?? []).map(stepText).join("\n")

    expect(journey.goal).toMatch(/archive/i)
    expect(statementText).toMatch(/physically deleted/i)
    expect(statementText).toMatch(/toContainText\('Archived'\)/)
  })
})
