/** @jest-environment node */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium, webkit, type Browser } from "playwright";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import config from "@/tailwind.config";
import { RegisterSummaryView } from "@/app/pos/register/RegisterSummaryView";
import { RegisterReconciliation } from "@/app/pos/register/RegisterReconciliation";
import { RegisterReadError } from "@/app/pos/register/RegisterReadError";
import { RegisterDashboardSkeleton } from "@/app/pos/register/RegisterSkeletons";
import { registerSummary } from "./register-ui-fixtures";

const root = process.cwd();
let css: string;

beforeAll(async () => {
  const content = ["RegisterSummaryView", "RegisterReconciliation", "RegisterReadError", "RegisterSkeletons"].map((name) => ({
    raw: readFileSync(path.join(root, `app/pos/register/${name}.tsx`), "utf8"), extension: "tsx",
  }));
  css = (await postcss([tailwindcss({ ...config, content })]).process(
    readFileSync(path.join(root, "app/globals.css"), "utf8"), { from: undefined },
  )).css;
});

describe.each([chromium, webkit])("cash register isolated rendering (%s)", (engine) => {
  const suite = existsSync(engine.executablePath()) ? describe : describe.skip;
  suite("real components and repository styles, without API or printer access", () => {
    let browser: Browser;
    beforeAll(async () => { browser = await engine.launch({ headless: true }); });
    afterAll(async () => { await browser?.close(); });

    it.each([320, 390, 1280])("keeps summary and audit details within a %s px viewport in both themes", async (width) => {
      const page = await browser.newPage({ viewport: { width, height: 850 } });
      try {
        await page.route("**/*", (route) => route.abort());
        const markup = renderToStaticMarkup(<>
          <RegisterReconciliation currency="USD" amount={150} difference={-5} />
          <RegisterSummaryView summary={{ ...registerSummary, movements: [{ ...registerSummary.movements[0], reason: "Long audit note ".repeat(20) }] }} currency="USD" />
          <RegisterReadError error="Forbidden POS request origin." />
          <RegisterDashboardSkeleton />
        </>);
        for (const theme of ["", "dark"]) {
          await page.setContent(`<!doctype html><html lang="en" class="${theme}" style="--font-inter:Arial;--font-museo-moderno:Arial"><head><title>Register layout</title><style>${css}</style></head><body style="background:hsl(var(--background));color:hsl(var(--foreground))"><main style="max-width:640px;padding:16px;margin:auto">${markup}</main></body></html>`);
          await page.getByText("Cash movements (1)", { exact: true }).click();
          await page.getByText("Receipts (1)", { exact: true }).click();
          expect(await page.getByText("Long audit note", { exact: false }).isVisible()).toBe(true);
          expect(await page.getByText("Cash shortage", { exact: true }).isVisible()).toBe(true);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
          const overflowing = await page.locator("main *").evaluateAll((elements) => elements.filter((element) => {
            const box = element.getBoundingClientRect();
            return box.width > 0 && (box.right > window.innerWidth + 1 || box.left < -1);
          }).map((element) => element.tagName));
          expect(overflowing).toEqual([]);
          if (width === 390 && !theme) await page.screenshot({ path: `/tmp/register-review-${engine.name()}.png`, fullPage: true });
        }
      } finally { await page.close(); }
    }, 20_000);
  });
});