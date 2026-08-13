import {
  compactOrderNotes,
  formatPosOrderLabel,
} from "@/app/pos/order-label";

const t = (key: string) => key;

describe("compactOrderNotes", () => {
  it("collapses whitespace and truncates long notes", () => {
    expect(compactOrderNotes("  mesa 4 \n no onions  ")).toBe("mesa 4 no onions");
    expect(compactOrderNotes("a".repeat(50))).toBe(`${"a".repeat(45)}…`);
    expect(compactOrderNotes("   ")).toBe("");
  });
});

describe("formatPosOrderLabel", () => {
  it("uses notes as the order name when present", () => {
    expect(
      formatPosOrderLabel(
        {
          created_at: "2026-08-13T17:45:00.000Z",
          notes: "Table 4",
          leads: { name: "Ana" },
        },
        t,
      ),
    ).toBe("Table 4");
  });

  it("prefers live notes over stored notes", () => {
    expect(
      formatPosOrderLabel({ notes: "Old" }, t, "VIP window"),
    ).toBe("VIP window");
    expect(formatPosOrderLabel({ notes: "Old" }, t, "")).toBe("Order");
  });

  it("falls back to time and customer when there are no notes", () => {
    const label = formatPosOrderLabel(
      {
        created_at: "2026-08-13T17:45:00.000Z",
        leads: { name: "Ana" },
      },
      t,
    );
    expect(label.startsWith("Order - ")).toBe(true);
    expect(label.endsWith(" (Ana)")).toBe(true);
  });
});
