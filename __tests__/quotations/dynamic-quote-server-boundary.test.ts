/** @jest-environment node */
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const internalFiles = [
  "app/quotations/dynamic-quote-sync.ts", "app/quotations/dynamic-quote-apply.ts",
  "app/quotations/dynamic-quote-resolve.ts", "app/quotations/dynamic-quote-api.ts",
  "app/quotations/dynamic-quote-request.ts", "app/quotations/dynamic-quote-access.ts",
  "app/quotations/dynamic-quote-input.ts",
  "app/commerce/private-site-access.ts", "app/lib/secrets-service.ts",
]

it.each(internalFiles)("keeps privileged generic helper %s server-only, not a Server Action module", (file) => {
  const source = fs.readFileSync(path.resolve(file), "utf8")
  expect(source).toMatch(/import ["']server-only["']/)
  expect(source).not.toMatch(/^\s*["']use server["']/m)
  expect(source.split("\n").length).toBeLessThan(500)
})

it("the installed Next compiler exports only verified public entry points, never generic helpers", () => {
  // Compile files in isolation, not a production build or an action-manifest assumption.
  const output = execFileSync(process.execPath, ["-e", `
    (async () => {
      const swc = require('next/dist/build/swc');
      await swc.loadBindings();
      const files = JSON.parse(process.argv[1]); const out = {};
      for (const file of files) {
        const filename = require('path').resolve(file);
        const {code} = await swc.transform(require('fs').readFileSync(filename, 'utf8'), {
          filename, jsc: { parser: {syntax: 'typescript'}, target: 'es2022' },
          serverActions: {isReactServerLayer: true, isDevelopment: false,
            useCacheEnabled: false, hashSalt: 'boundary-test', cacheKinds: []},
        });
        const match = code.match(/__next_internal_action_entry_do_not_use__ ([^\\n]*?) \\*\\//);
        out[file] = match ? Object.values(JSON.parse(match[1])).map(x => x.name).sort() : [];
      }
      process.stdout.write(JSON.stringify(out));
    })().catch(e => {console.error(e); process.exit(1)});
  `, JSON.stringify([...internalFiles, "app/quotations/dynamic-quote-progress.ts", "app/quotations/dynamic-quote-actions.ts", "app/quotations/public-dynamic-quote.ts"])], { encoding: "utf8" })
  const entries = JSON.parse(output)
  for (const file of internalFiles) expect(entries[file]).toEqual([])
  expect(entries["app/quotations/dynamic-quote-progress.ts"]).toEqual(["pollDynamicQuoteProgress"])
  expect(entries["app/quotations/public-dynamic-quote.ts"]).toEqual(["requestPublicDynamicQuote"])
  expect(entries["app/quotations/dynamic-quote-actions.ts"]).toEqual([
    "applyDynamicQuoteFromText", "authorizeDynamicQuote", "requestDynamicQuote", "retryDynamicQuoteItem",
  ])
})

it("the browser intake imports the narrow public action, not staff identity resolution or generic transports", () => {
  const source = fs.readFileSync(path.resolve("app/components/commerce/pdp/DynamicQuotePdpProvider.tsx"), "utf8")
  expect(source).toContain("requestPublicDynamicQuote")
  expect(source).not.toMatch(/findOrCreateLeadForBuyer|dynamic-quote-(sync|apply|resolve|request)/)
})