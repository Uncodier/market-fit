/** @jest-environment node */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { transformSync } from "next/dist/build/swc"

const appDir = join(process.cwd(), "app")
const reportFiles = [
  "ReportContent.tsx",
  "DashboardPerformanceTab.tsx",
  "DashboardOverviewTab.tsx",
  "OverviewEconomics.tsx",
  "OverviewEconomicsCharts.tsx",
  "OverviewSalesTrend.tsx",
  "DashboardFilters.tsx",
  "DashboardAnalyticsTab.tsx",
  "page.tsx",
  "loading.tsx",
]

function compile(source: string, filename: string, isServerCompiler: boolean) {
  return transformSync(source, {
    filename,
    appDir,
    isDevelopment: true,
    isServerCompiler,
    jsc: {
      parser: { syntax: "typescript", tsx: true },
      target: "es2022",
      transform: { react: { runtime: "automatic" } },
    },
  })
}

// Render tests mock next/dynamic; use the installed Next compiler to catch its
// static import constraints without a production build or executing report APIs.
describe.each([false, true])("dashboard compiler (server=%s)", isServer => {
  it.each(reportFiles)("compiles %s with the real Next dynamic transform", file => {
    const filename = join(appDir, "dashboard", file)
    const result = compile(readFileSync(filename, "utf8"), filename, isServer)
    expect(result.code.length).toBeGreaterThan(0)
  })

  it("detects the shared-options pattern that caused the compilation failure", () => {
    const source = `"use client";
      import dynamic from "next/dynamic";
      const options = { ssr: false };
      const Report = dynamic(() => import("./DashboardAnalyticsTab"), options);
      export default Report;`
    expect(() => compile(source, join(appDir, "dashboard", "invalid-report.tsx"), isServer))
      .toThrow(/next\/dynamic options must be an object literal/)
  })
})