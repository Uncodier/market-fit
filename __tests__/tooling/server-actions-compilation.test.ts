/** @jest-environment node */

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { transformSync } from "next/dist/build/swc"

function serverActionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = join(directory, entry.name)
    if (entry.isDirectory()) return serverActionFiles(filename)
    if (!/\.(ts|tsx)$/.test(entry.name)) return []
    return /^\s*["']use server["']/.test(readFileSync(filename, "utf8")) ? [filename] : []
  })
}

const files = ["app", "lib"].flatMap(directory => serverActionFiles(join(process.cwd(), directory)))

describe.each([false, true])("Server Action exports (server=%s)", isReactServerLayer => {
  it.each(files)("compiles %s with the installed Next.js action transform", filename => {
    const result = transformSync(readFileSync(filename, "utf8"), {
      filename,
      isServerCompiler: isReactServerLayer,
      jsc: {
        parser: { syntax: "typescript", tsx: filename.endsWith(".tsx") },
        target: "es2022",
      },
      serverActions: {
        isReactServerLayer,
        isDevelopment: true,
        useCacheEnabled: false,
        hashSalt: "server-action-regression",
        cacheKinds: ["default", "remote", "private"],
      },
    })
    expect(result.code.length).toBeGreaterThan(0)
  })
})