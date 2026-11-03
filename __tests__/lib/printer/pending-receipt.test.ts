import { encodeReceipt } from "@/lib/printer/templates/receipt";
import { htmlForJob } from "@/lib/printer/templates";

const receipt = { lines: [], total: 10, confirmationPending: true, localReference: "payment-123" };

it.each([58, 80] as const)("marks optimistic receipts as pending in ESC/POS and HTML on %s mm paper", (width) => {
  const bytes = String.fromCharCode(...encodeReceipt(receipt, width));
  const html = htmlForJob({ id: "receipt", module: "pos", template: "receipt", payload: receipt }, width);
  for (const output of [bytes, html]) {
    expect(output).toContain("PAYMENT CONFIRMATION PENDING");
    expect(output).toContain("payment-123");
    expect(output).toContain("Not proof");
  }
});

it("does not label confirmed receipts as pending", () => {
  const bytes = String.fromCharCode(...encodeReceipt({ lines: [], total: 10 }, 80));
  expect(bytes).not.toContain("PAYMENT CONFIRMATION PENDING");
});