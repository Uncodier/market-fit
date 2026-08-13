import { buyerUserFromLeads } from "@/app/pos/assign-digital-buyer";

describe("buyerUserFromLeads", () => {
  it("returns null without a matching lead email", () => {
    expect(buyerUserFromLeads(null, [])).toBeNull();
    expect(
      buyerUserFromLeads("user-1", [{ buyer_user_id: "user-1", name: "Ada" }]),
    ).toBeNull();
  });

  it("rebuilds a buyer user from a linked lead", () => {
    expect(
      buyerUserFromLeads("user-1", [
        {
          buyer_user_id: "user-1",
          email: "ada@example.com",
          name: "Ada",
        },
      ]),
    ).toEqual({
      buyerUserId: "user-1",
      email: "ada@example.com",
      name: "Ada",
    });
  });
});
