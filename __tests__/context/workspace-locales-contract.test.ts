/** @jest-environment node */
import { readFileSync, readdirSync } from "fs"
import { join } from "path"
import { localeMessages, rawLocaleMessages } from "@/app/context/locale-catalog"

const { audit, collectSourceReferences, loadRawLocales } = jest.requireActual("../../scripts/i18n/audit.cjs")
const root = join(__dirname, "../..")
const raw = loadRawLocales(root) as Record<string, Record<string, string>>
const report = audit(root)

function jsonFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = join(directory, entry.name)
    return entry.isDirectory() ? jsonFiles(filename) : filename.endsWith(".json") ? [filename] : []
  })
}

const parameters = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort()

describe("workspace locale coverage without English fallback", () => {
  it("registers every on-disk overlay in the runtime catalog", () => {
    for (const locale of ["en", "es", "fr", "de", "ja"] as const) {
      expect(rawLocaleMessages[locale]).toEqual(raw[locale])
    }
  })
  it.each(["en", "es"])("provides every literal, mapped and known dynamic key in %s", (locale) => {
    expect(report.missing[locale]).toEqual([])
  })

  it("keeps Spanish workspace overlays connected to the runtime catalog", () => {
    for (const filename of jsonFiles(join(root, "app/context/locales/workspace/es"))) {
      const messages = JSON.parse(readFileSync(filename, "utf8")) as Record<string, string>
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim()).not.toBe("")
        expect(raw.en[key]).toBeDefined()
        expect(parameters(value)).toEqual(parameters(raw.en[key]))
        expect(localeMessages.es[key]).toBe(raw.es[key])
      }
      expect(readFileSync(filename, "utf8").split("\n").length).toBeLessThan(500)
    }
  })

  it("keeps each new screen's Spanish keys and parameters aligned with English", () => {
    const directory = join(root, "app/context/locales/screens")
    for (const filename of jsonFiles(directory).filter((file) => file.endsWith("-en.json"))) {
      const english = JSON.parse(readFileSync(filename, "utf8")) as Record<string, string>
      const spanish = JSON.parse(readFileSync(filename.replace(/-en\.json$/, "-es.json"), "utf8")) as Record<string, string>
      expect(Object.keys(spanish).sort()).toEqual(Object.keys(english).sort())
      for (const [key, value] of Object.entries(english)) {
        expect(spanish[key].trim()).not.toBe("")
        expect(parameters(spanish[key])).toEqual(parameters(value))
        expect(localeMessages.en[key]).toBe(raw.en[key])
        expect(localeMessages.es[key]).toBe(raw.es[key])
      }
    }
  })

  it("audits mapped and dynamic keys and flags direct text and accessible labels", () => {
    const result = collectSourceReferences("example.tsx", `
      const keys = { title: "example.title" }
      const text = t("example.literal")
      const status = t(\`example.status.\${value}\`)
      const view = <button aria-label="Retry operation">Retry</button>
    `, { "example.title": "Title", "example.status.active": "Active" })
    expect(result.keys).toEqual(["example.literal", "example.status.active", "example.title"])
    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "aria-label", text: "Retry operation" }),
      expect.objectContaining({ kind: "text", text: "Retry" }),
    ]))
  })
})