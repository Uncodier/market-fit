import { readFileSync } from "fs"
import path from "path"
import postcss from "postcss"

const css = postcss.parse(readFileSync(path.join(process.cwd(), "app/components/navigation/mobile-workspace-navigation.module.css"), "utf8"))

function declarations(selector: string) {
  const values: Record<string, string> = {}
  css.walkRules((rule) => {
    if (rule.selector !== selector) return
    rule.walkDecls((declaration) => { values[declaration.prop] = declaration.value })
  })
  return values
}

it("keeps long labels inside the curved tab with room for text descenders", () => {
  expect(declarations(".label")).toMatchObject({
    width: "calc(100% - 16px)",
    "max-width": "calc(100% - 16px)",
    "min-width": "0",
    overflow: "hidden",
    "white-space": "nowrap",
    "text-overflow": "ellipsis",
    "line-height": "14px",
    "-webkit-text-size-adjust": "none",
  })
  expect(declarations(".tab")["grid-template-rows"]).toBe("25px 14px")
})