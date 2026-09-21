import {
  getCatalogInitials,
  getCatalogItemInitial,
  sortCatalogItemsAlphabetically,
} from "@/app/pos/catalog-alphabet";

describe("POS catalog alphabet", () => {
  it("normalizes accented initials and groups non-letters", () => {
    expect(getCatalogItemInitial("  Ágave")).toBe("A");
    expect(getCatalogItemInitial("éclair")).toBe("E");
    expect(getCatalogItemInitial("123 bundle")).toBe("#");
  });

  it("sorts items by name without mutating the source", () => {
    const items = [{ name: "Zebra" }, { name: "Ágave" }, { name: "item 2" }];

    expect(sortCatalogItemsAlphabetically(items).map((item) => item.name)).toEqual([
      "Ágave",
      "item 2",
      "Zebra",
    ]);
    expect(items.map((item) => item.name)).toEqual(["Zebra", "Ágave", "item 2"]);
  });

  it("returns each available initial once with symbols last", () => {
    expect(
      getCatalogInitials([
        { name: "Banana" },
        { name: "Ágave" },
        { name: "Apple" },
        { name: "2-pack" },
      ]),
    ).toEqual(["A", "B", "#"]);
  });
});
