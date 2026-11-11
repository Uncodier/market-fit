/** @jest-environment node */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import postcss from "postcss"

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8")
const stylesheet = postcss.parse(read("app/styles/mobile-toast-offset.css"))

test("offsets only bottom toasts while the mobile navigation is rendered", () => {
  const selectors: string[] = []
  stylesheet.walkRules((rule) => {
    selectors.push(rule.selector)
    expect(rule.parent).toMatchObject({ name: "media", params: "(max-width: 767px)" })
    const bottom = rule.nodes.find((node) => node.type === "decl" && node.prop === "bottom")
    expect(bottom).toMatchObject({ value: "calc(88px + env(safe-area-inset-bottom, 0px))" })
  })
  expect(selectors).toEqual([
    "body:has([data-mobile-workspace-navigation]) [data-sonner-toaster][data-y-position='bottom']",
  ])
})

test("loads the override globally and marks only the actual rendered bar", () => {
  expect(read("app/layout.tsx")).toContain('import "./styles/mobile-toast-offset.css"')
  const navigation = read("app/components/navigation/MobileWorkspaceNavigation.tsx")
  expect(navigation).toContain("data-mobile-workspace-navigation")
  expect(navigation.indexOf('if (hasId(')).toBeLessThan(navigation.indexOf("data-mobile-workspace-navigation"))
})