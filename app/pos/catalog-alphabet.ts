import type { CatalogItem } from "@/app/types";

const NON_SPACING_MARKS = /\p{Diacritic}/gu;
const LATIN_LETTER = /^[A-Z]$/;

export function getCatalogItemInitial(name: string): string {
  const firstCharacter = name
    .trim()
    .normalize("NFD")
    .replace(NON_SPACING_MARKS, "")
    .charAt(0)
    .toUpperCase();

  return LATIN_LETTER.test(firstCharacter) ? firstCharacter : "#";
}

export function sortCatalogItemsAlphabetically<T extends Pick<CatalogItem, "name">>(
  items: T[],
): T[] {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
}

export function moveUncategorizedCatalogItemsToEnd<
  T extends Pick<CatalogItem, "category_id">,
>(items: T[]): T[] {
  return [
    ...items.filter((item) => Boolean(item.category_id)),
    ...items.filter((item) => !item.category_id),
  ];
}

export function getCatalogInitials(
  items: Array<Pick<CatalogItem, "name">>,
): string[] {
  return Array.from(
    new Set(items.map((item) => getCatalogItemInitial(item.name))),
  ).sort((left, right) => {
    if (left === "#") return 1;
    if (right === "#") return -1;
    return left.localeCompare(right);
  });
}
