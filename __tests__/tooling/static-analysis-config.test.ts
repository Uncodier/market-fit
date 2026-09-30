/** @jest-environment node */

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()

describe("static analysis configuration", () => {
  it("keeps strict type checking for application code and authored tests", () => {
    const config = JSON.parse(readFileSync(join(root, "tsconfig.json"), "utf8"))
    expect(config.compilerOptions.strict).toBe(true)
    expect(config.compilerOptions.noEmit).toBe(true)
    expect(config.compilerOptions.target).toBe("es2018")
    expect(config.include).toEqual(expect.arrayContaining(["**/*.ts", "**/*.tsx"]))
    expect(config.exclude).toEqual(["node_modules"])
  })

  it("generates route definitions before checking a clean checkout", () => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
    expect(manifest.scripts.typecheck).toBe("next typegen && tsc --noEmit")
  })

  it("does not bypass type errors during a production build", () => {
    const source = readFileSync(join(root, "next.config.js"), "utf8")
    expect(source).not.toMatch(/ignoreBuildErrors\s*:\s*true/)
  })

  it("applies real TypeScript and React rules to source files and tests", () => {
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", `
      import { ESLint } from "eslint";
      const eslint = new ESLint();
      const files = [
        "app/purchases/actions.ts", "app/assets/page.tsx",
        "__tests__/purchases/actions-queries.test.ts", "tests/agent/agent-evidence.ts",
      ];
      const results = await Promise.all(files.map(async file => {
        const config = await eslint.calculateConfigForFile(file);
        return {
          file,
          ignored: await eslint.isPathIgnored(file),
          typescriptRule: config?.rules?.["@typescript-eslint/no-explicit-any"],
          hooksRule: config?.rules?.["react-hooks/rules-of-hooks"],
        };
      }));
      const invalid = await eslint.lintText("export function unsafe(value: any) { return value }", {
        filePath: "app/static-analysis-example.ts",
      });
      console.log(JSON.stringify({ results, invalid: invalid[0].messages.map(m => m.ruleId) }));
    `], { cwd: root, encoding: "utf8" })
    const { results, invalid } = JSON.parse(output)
    for (const result of results) {
      expect(result.ignored).toBe(false)
      expect(result.typescriptRule[0]).toBe(2)
      expect(result.hooksRule[0]).toBe(2)
    }
    expect(invalid).toContain("@typescript-eslint/no-explicit-any")
  })
})