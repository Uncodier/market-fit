import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "out/**",
    "dist/**",
    "build/**",
    "coverage/**",
    ".playwright-browsers/**",
    "test-results/**",
    "shiplight-report/**",
    ".shiplight/**",
    "agent-test-reports/**",
    "tests/agent/**/.runtime/**",
    "**/*.yaml.spec.ts",
    "next-env.d.ts",
  ]),
  {
    // CommonJS is the intentional runtime format for local tooling and configs.
    files: ["**/*.cjs", "*.config.js", "scripts/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
])