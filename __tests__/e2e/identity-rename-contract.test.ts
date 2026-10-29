/** @jest-environment node */

import fs from "node:fs"
import path from "node:path"
import { parse } from "yaml"

type Step = { intent?: string; action?: string; locator?: string; value?: string; keys?: string; js?: string; VERIFY?: string; WAIT_UNTIL?: string }
type Journey = { statements: Step[]; teardown: Step[]; tags: string[] }

it.each([
  ["campaign", "Edit campaign title", "Campaign title"],
  ["deal", "Edit deal name", "Deal name"],
])("%s rename uses exact semantic targets and preserves hard persistence/cleanup checks", (entity, button, textbox) => {
  const source = fs.readFileSync(path.join(process.cwd(), `tests/crud-${entity}.test.yaml`), "utf8")
  const journey = parse(source) as Journey
  const steps = journey.statements
  const editIndex = steps.findIndex(step => step.intent?.startsWith("Click Edit"))
  expect(editIndex).toBeGreaterThan(-1)
  expect(steps[editIndex]).toMatchObject({
    action: "click", locator: `getByRole('button', { name: '${button}', exact: true })`,
  })
  expect(steps[editIndex + 1]).toMatchObject({
    action: "fill", locator: `getByRole('textbox', { name: '${textbox}', exact: true })`,
    value: `{{${entity}EditedName}}`,
  })
  expect(steps[editIndex + 2]).toMatchObject({ action: "press", keys: "Enter" })
  expect(source).not.toContain("input.h-8")
  expect(source).not.toMatch(/getByRole\('heading'.*\.click\(/)
  expect(steps.some(step => step.VERIFY || step.WAIT_UNTIL)).toBe(false)
  expect(steps.every(step => step.js || step.action || "URL" in step)).toBe(true)

  const reloadIndex = steps.findIndex(step => step.js?.includes("page.reload()"))
  const persistedIndex = steps.findIndex(step => step.js?.includes(".assertPersisted("))
  expect(reloadIndex).toBeGreaterThan(editIndex + 2)
  expect(steps[reloadIndex + 1].js).toContain("expect(page.getByRole('heading'")
  expect(steps[reloadIndex + 1].js).toContain(`${entity}EditedName`)
  expect(persistedIndex).toBeGreaterThan(reloadIndex)
  expect(steps[persistedIndex].js).toContain(`.assertPersisted(testContext, '${entity}', testContext.get('${entity}EditedName'))`)
  expect(source).toContain(".requireMutationEnvironment()")
  expect(source).toContain(".bindBrowserFixture(page)")
  expect(source).toContain(`.remember(testContext, '${entity}')`)
  expect(journey.teardown.map(step => step.js).join("\n")).toContain(".cleanup(testContext)")
  expect(journey.teardown.map(step => step.js).join("\n")).toContain(".assertReadObservation(page)")
  expect(journey.tags).toEqual(expect.arrayContaining(["regression", "mutation"]))
})