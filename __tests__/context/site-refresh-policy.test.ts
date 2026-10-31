import { canRecoverMissingPosSite } from "@/app/context/site-refresh-policy";

it("permits only explicitly requested recovery of the missing POS context", () => {
  expect(canRecoverMissingPosSite({ recoverMissingSite: true }, undefined, "/pos")).toBe(true);
  expect(canRecoverMissingPosSite(undefined, undefined, "/pos")).toBe(false);
  expect(canRecoverMissingPosSite({ recoverMissingSite: false }, undefined, "/pos")).toBe(false);
  expect(canRecoverMissingPosSite({ recoverMissingSite: true }, "site-a", "/pos")).toBe(false);
  expect(canRecoverMissingPosSite({ recoverMissingSite: true }, undefined, "/settings")).toBe(false);
  expect(canRecoverMissingPosSite({ recoverMissingSite: true }, undefined, "/pos/check-in")).toBe(false);
});