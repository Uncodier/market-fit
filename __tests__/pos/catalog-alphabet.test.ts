import {
  getCatalogInitials,
  getCatalogItemInitial,
  moveUncategorizedCatalogItemsToEnd,
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

  it("moves uncategorized items to the end without changing group order", () => {
    const items = [
      { name: "Uncategorized A" },
      { name: "Category B", category_id: "category-b" },
      { name: "Uncategorized B", category_id: undefined },
      { name: "Category A", category_id: "category-a" },
    ];

    expect(
      moveUncategorizedCatalogItemsToEnd(items).map((item) => item.name),
    ).toEqual([
      "Category B",
      "Category A",
      "Uncategorized A",
      "Uncategorized B",
    ]);
    expect(items[0].name).toBe("Uncategorized A");
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
