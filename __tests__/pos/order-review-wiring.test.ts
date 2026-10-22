/** @jest-environment node */
import { readFileSync } from "node:fs";
import path from "node:path";

it("reviews queued orders separately from the unpaid-only payment cart", () => {
  const source = readFileSync(path.join(process.cwd(), "app/pos/PosWorkspace.tsx"), "utf8");
  expect(source).not.toMatch(/onReviewOrder=\{[^\n]*handleOrderSelect/);
  expect(source).toContain("<PosOrderReviewDialog");
});