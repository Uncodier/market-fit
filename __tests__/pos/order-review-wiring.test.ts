/** @jest-environment node */
import { readFileSync } from "node:fs";
import path from "node:path";

it("reviews queued orders separately from the unpaid-only payment cart", () => {
  const source = readFileSync(path.join(process.cwd(), "app/pos/PosWorkspace.tsx"), "utf8");
  expect(source).not.toMatch(/onReviewOrder=\{[^\n]*handleOrderSelect/);
  expect(source).toContain("<PosOrderReviewDialog");
  expect(source).toContain("onReviewOrder={(orderId, rowId) => setReviewOrder({ siteId, orderId, rowId })}");
  expect(source).toContain("rowId={reviewOrder?.siteId === siteId ? reviewOrder?.rowId : undefined}");
  expect(source).toContain("cartApi.handleOrderSelect(orderId, true)");
  expect(source).toContain("onContinueSelling={() => { setSyncIssuesOpen(false); setReviewOrder(null); }}");
});