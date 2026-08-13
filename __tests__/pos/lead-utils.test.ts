import { hasPosCustomer } from "@/app/pos/lead-utils";

describe("hasPosCustomer", () => {
  it("is false for empty values", () => {
    expect(hasPosCustomer(null)).toBe(false);
    expect(hasPosCustomer(undefined)).toBe(false);
    expect(hasPosCustomer("")).toBe(false);
  });

  it("is true for an existing lead id", () => {
    expect(hasPosCustomer("lead-1")).toBe(true);
    expect(
      hasPosCustomer({ mode: "existing", id: "lead-1", label: "Ada" }),
    ).toBe(true);
  });

  it("is true when creating a named lead", () => {
    expect(hasPosCustomer({ mode: "create", label: "Ada Lovelace" })).toBe(
      true,
    );
    expect(hasPosCustomer({ mode: "create", label: "  " })).toBe(false);
  });
});
