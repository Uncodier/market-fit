/** @jest-environment node */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import postcss from "postcss"

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8")

test("floats over the full-height content without reserving layout space", () => {
  const layout = read("app/layout-client.tsx")
  const chat = read("app/chat/page.tsx")
  expect(layout).not.toContain("mobile-navigation-height")
  expect(layout).not.toContain("paddingBottom")
  expect(layout).not.toContain("max-md:flex-none")
  expect(layout).toContain("isRobotsPage ? '100dvh' : 'calc(100dvh - 64px)'")
  expect(chat).not.toContain("mobile-navigation-height")
  expect(chat).toContain("top-[var(--topbar-height,64px)] bottom-0")
})

test("uses theme tokens for glass, selected tabs, focus and reduced transparency", () => {
  const css = read("app/components/navigation/mobile-workspace-navigation.module.css")
  const rules = postcss.parse(css)
  const declarations: Record<string, string> = {}
  rules.walkRules((rule) => {
    rule.walkDecls((declaration) => {
      declarations[`${rule.selector}:${declaration.prop}`] = declaration.value
    })
  })
  expect(declarations['.tab[aria-current="page"]:color']).toBe("hsl(var(--accent-foreground))")
  expect(declarations[".tab::before:background"]).toBe("hsl(var(--accent))")
  expect(declarations[".tab:color"]).toBe("hsl(var(--muted-foreground))")
  expect(declarations[".tab:focus-visible:outline"]).toContain("var(--ring)")
  expect(declarations[".glass:background"]).toBe("hsl(var(--background))")
  expect(css).toContain("hsl(var(--card) / 78%)")
  expect(css).not.toMatch(/#[\da-f]{3,8}\b/i)
  expect(declarations[".label:width"]).toBe("100%")
  expect(declarations[".label:white-space"]).toBe("nowrap")
  expect(declarations[".label:text-overflow"]).toBe("ellipsis")
  expect(declarations[".label:overflow"]).toBe("hidden")
  expect(declarations[".label:-webkit-line-clamp"]).toBeUndefined()
  expect(declarations[".tab:display"]).toBe("grid")
  expect(declarations[".tab:grid-template-rows"]).toBe("25px 11px")
  expect(declarations[":global(html.safari) .glass[data-mobile-workspace-navigation] a.tab:display"]).toBe("grid")
  expect(declarations[":global(html.safari) .glass[data-mobile-workspace-navigation] a.tab > .label:text-align"]).toBe("center")
})