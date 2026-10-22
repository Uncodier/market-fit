/** @jest-environment node */
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { transformSync } from "next/dist/build/swc"

const root = join(process.cwd(), "app/components/agents")
const directory = join(root, "imprenta-panel")
const modules = ["imprenta-panel.tsx", ...readdirSync(directory)
  .filter(name => /\.(ts|tsx)$/.test(name))
  .map(name => `imprenta-panel/${name}`)]

it.each(modules)("compiles Content Creator module %s with the installed Next compiler", name => {
  const filename = join(root, name)
  const source = readFileSync(filename, "utf8")
  expect(source.split("\n").length).toBeLessThan(500)
  const output = transformSync(source, {
    filename,
    jsc: {
      parser: { syntax: "typescript", tsx: name.endsWith(".tsx") },
      target: "es2022",
      transform: { react: { runtime: "automatic" } },
    },
  })
  // Type-only modules legitimately emit no runtime JavaScript.
  expect(typeof output.code).toBe("string")
})