import { VARIANT_AXES_CATALOG } from "./app/catalog/variant-axes.ts";

console.log("Mock data test - VARIANT_AXES_CATALOG");
console.log(JSON.stringify(VARIANT_AXES_CATALOG, null, 2));

// Creating mock item with empty label
const mockItem = {
  id: "mock-1",
  name: "Mock Item",
  metadata: {
    variant_axes: [
      {
        kind: "size",
        label: "",
        option_values: ["Small", "Medium"]
      }
    ]
  }
};

console.log("\nMock Item with empty label:");
console.log(JSON.stringify(mockItem, null, 2));
