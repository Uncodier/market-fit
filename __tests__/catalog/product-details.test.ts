import { getDefaultSpecCategorySlugsForItem, getListingMetaChips } from "@/app/catalog/product-details";
import { CatalogItem } from "@/app/types";

describe("product-details item_spec helpers", () => {
  describe("getDefaultSpecCategorySlugsForItem", () => {
    it("returns correct defaults for product", () => {
      const item = { kind: 'product' } as CatalogItem;
      expect(getDefaultSpecCategorySlugsForItem(item)).toEqual(['brand', 'collection']);
    });

    it("returns correct defaults for service", () => {
      const item = { kind: 'service' } as CatalogItem;
      expect(getDefaultSpecCategorySlugsForItem(item)).toEqual(['instructor', 'host', 'venue']);
    });

    it("returns correct defaults for course", () => {
      const item = { kind: 'digital_asset', digital_subtype: 'course' } as CatalogItem;
      expect(getDefaultSpecCategorySlugsForItem(item)).toEqual(['instructor', 'author', 'collection']);
    });

    it("returns correct defaults for ticket", () => {
      const item = { kind: 'digital_asset', digital_subtype: 'ticket' } as CatalogItem;
      expect(getDefaultSpecCategorySlugsForItem(item)).toEqual(['event', 'artist', 'venue', 'organizer']);
    });

    it("returns correct defaults for pass", () => {
      const item = { kind: 'digital_asset', digital_subtype: 'pass' } as CatalogItem;
      expect(getDefaultSpecCategorySlugsForItem(item)).toEqual(['venue', 'organizer']);
    });

    it("returns correct defaults for file", () => {
      const item = { kind: 'digital_asset', digital_subtype: 'file' } as CatalogItem;
      expect(getDefaultSpecCategorySlugsForItem(item)).toEqual(['author', 'publisher']);
    });

    it("returns correct defaults for license", () => {
      const item = { kind: 'digital_asset', digital_subtype: 'license' } as CatalogItem;
      expect(getDefaultSpecCategorySlugsForItem(item)).toEqual(['publisher']);
    });
  });

  describe("getListingMetaChips priority", () => {
    it("prefers item_specs over legacy attributes", () => {
      const item = {
        kind: 'digital_asset',
        digital_subtype: 'ticket',
        item_specs: [
          { name: 'Coachella', category: { slug: 'event' } },
          { name: 'Daft Punk', category: { slug: 'artist' } }
        ],
        metadata: {
          attributes: {
            venue: 'Legacy Venue'
          }
        }
      } as unknown as CatalogItem;

      const chips = getListingMetaChips(item);
      expect(chips).toEqual([
        { value: 'Coachella' },
        { value: 'Daft Punk' }
      ]);
    });

    it("falls back to legacy attributes if specs are missing", () => {
      const item = {
        kind: 'digital_asset',
        digital_subtype: 'ticket',
        item_specs: [],
        metadata: {
          attributes: {
            venue: 'Legacy Venue',
            event_date: '2026-12-31'
          }
        }
      } as unknown as CatalogItem;

      const chips = getListingMetaChips(item);
      expect(chips).toEqual([
        { value: 'Legacy Venue' },
        { value: '2026-12-31' }
      ]);
    });
  });
});
