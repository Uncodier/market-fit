import {
  hasPosCustomer,
  planPosLeadSync,
} from "@/app/pos/lead-utils";

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

describe("planPosLeadSync", () => {
  it("uses a server lead without creating sync work", () => {
    expect(
      planPosLeadSync(
        { mode: "existing", id: "lead-1", label: "Ada" },
        () => "unused",
      ),
    ).toEqual({
      resolvedLeadId: "lead-1",
      localLeadId: null,
      createLead: null,
    });
  });

  it("keeps a local lead reference for the outbox", () => {
    expect(
      planPosLeadSync(
        { mode: "existing", id: "local_lead-1", label: "Ada" },
        () => "unused",
      ),
    ).toEqual({
      resolvedLeadId: null,
      localLeadId: "local_lead-1",
      createLead: null,
    });
  });

  it("plans new customers locally without requiring a server response", () => {
    const ids = ["lead-id", "mutation-id"];

    expect(
      planPosLeadSync(
        { mode: "create", label: "  Ada Lovelace  " },
        () => ids.shift() || "unexpected",
      ),
    ).toEqual({
      resolvedLeadId: null,
      localLeadId: "local_lead-id",
      createLead: {
        localLeadId: "local_lead-id",
        name: "Ada Lovelace",
        clientMutationId: "mutation-id",
      },
    });
  });
});
