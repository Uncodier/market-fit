/** @jest-environment node */
import { connectorRoute } from "@/app/api/connectors/contracts"

test("the connectors proxy has no manual pending-attempt selector for single-use proofs", () => {
  expect(connectorRoute(["pending-auth"], "GET")).toBeNull()
})
