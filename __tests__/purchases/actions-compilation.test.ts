/** @jest-environment node */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { transformSync } from "next/dist/build/swc"

const queryActions = ["listPurchases", "getPurchaseById", "getPurchaseWithoutContext"]
const modules = [
  {
    file: "actions.ts",
    exports: [
      ...queryActions,
      "createPurchase",
      "updatePurchase",
      "registerPurchasePayment",
      "receivePurchaseStock",
      "publishPurchase",
      "unpublishPurchase",
      "deletePurchase",
    ],
  },
  { file: "purchase-queries.ts", exports: queryActions },
]

function compile(source: string, filename: string, isReactServerLayer: boolean) {
  return transformSync(source, {
    filename,
    isServerCompiler: isReactServerLayer,
    jsc: { parser: { syntax: "typescript" }, target: "es2022" },
    serverActions: {
      isReactServerLayer,
      isDevelopment: true,
      useCacheEnabled: false,
      hashSalt: "purchase-actions-test",
      cacheKinds: ["default", "remote", "private"],
    },
  })
}

// next/jest skips the Server Actions transform. Compile the real source without
// executing database operations or running a production build.
describe.each([false, true])("purchase action compiler (server=%s)", isServer => {
  it.each(modules)("registers every action in $file", ({ file, exports }) => {
    const filename = join(process.cwd(), "app/purchases", file)
    const result = compile(readFileSync(filename, "utf8"), filename, isServer)
    const entry = result.code.match(/__next_internal_action_entry_do_not_use__ (.*?) \*\//)

    expect(entry).not.toBeNull()
    const actions: Record<string, { name: string }> = JSON.parse(entry![1])
    expect(Object.values(actions).map(action => action.name).sort())
      .toEqual([...exports].sort())
  })

  it("rejects the direct re-export that caused the build failure", () => {
    const filename = join(process.cwd(), "app/purchases/invalid-actions.ts")
    const source = `"use server";
      export { listPurchases, getPurchaseById, getPurchaseWithoutContext } from "./purchase-queries";`

    expect(() => compile(source, filename, isServer))
      .toThrow(/Only async functions are allowed to be exported in a "use server" file/)
  })
})