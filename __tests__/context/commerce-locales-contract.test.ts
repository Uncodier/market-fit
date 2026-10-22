/** @jest-environment node */
import { readFileSync, readdirSync } from "fs"
import { join } from "path"
import ts from "typescript"
import { commerceMessages, rawLocaleMessages } from "@/app/context/locale-catalog"
import type { SupportedLocale } from "@/app/context/locale-preferences"

const root = join(__dirname, "../..")
const locales: SupportedLocale[] = ["en", "es", "fr", "de", "ja"]
const scopes = ["app/marketplace", "app/components/commerce", "app/cart"]

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(path) ? [path] : []
  })
}

const keys = new Set<string>()
const checkoutKeys = new Set<string>()
for (const scope of scopes) for (const path of sourceFiles(join(root, scope))) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true)
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      if (node.expression.getText(source) === "t") keys.add(node.arguments[0].text)
      if (node.expression.getText(source) === "checkoutLabelKey") checkoutKeys.add(node.arguments[0].text)
    }
    // Dynamic category/subtype and sorting maps contain explicit keys too.
    if (ts.isStringLiteral(node) && /^marketplace\./.test(node.text)) keys.add(node.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
}
for (const key of checkoutKeys) {
  keys.add(key)
  keys.add(`${key}Service`)
}

describe("commerce locale coverage without English fallback", () => {
  it.each(locales)("provides every referenced commerce key in %s", (locale) => {
    const raw = rawLocaleMessages[locale]
    expect([...keys].filter((key) => typeof raw[key] !== "string" || !raw[key].trim())).toEqual([])
  })

  it.each(locales)("keeps feature keys and interpolation parameters consistent in %s", (locale) => {
    expect(Object.keys(commerceMessages[locale]).sort()).toEqual(Object.keys(commerceMessages.en).sort())
    const parameters = (value: string) => [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort()
    for (const [key, value] of Object.entries(commerceMessages.en)) {
      expect(parameters(commerceMessages[locale][key])).toEqual(parameters(value))
    }
  })

  it.each(["es", "fr", "de", "ja"] as const)("translates critical controls and errors in %s", (locale) => {
    for (const [key, value] of Object.entries(commerceMessages.en)) {
      if (/^marketplace\.(filters|sort|checkout\.errors|notFound)\./.test(key)) {
        expect(commerceMessages[locale][key]).not.toBe(value)
      }
    }
  })
})