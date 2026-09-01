import { getDefaultSpecCategorySlugsForItem, getListingCtaLabel, getListingMetaChips, getPdpCustomSpecs, getPdpFilledAttributeFields, getPdpSpecDisplay } from "@/app/catalog/product-details";
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

  describe("getPdpSpecDisplay", () => {
    it("groups custom specs by category and skips system ones", () => {
      const item = {
        kind: "service",
        item_specs: [
          { id: "1", name: "Proyección Especial", category: { name: "Detalles Del Evento", is_system: false } },
          { id: "2", name: "Vocal Selections", image_url: "https://cdn.example/vocal.jpg", category: { name: "Detalles Del Evento", is_system: false } },
          { id: "3", name: "Studio A", category: { name: "Venue", slug: "venue", is_system: true } },
        ],
        metadata: {
          specs: [{ label: "Runtime", value: "60 min" }],
        },
      } as unknown as CatalogItem;

      expect(getPdpSpecDisplay(item)).toEqual({
        groups: [
          {
            title: "Detalles Del Evento",
            items: [
              { id: "1", name: "Proyección Especial", image_url: undefined, video_url: undefined },
              { id: "2", name: "Vocal Selections", image_url: "https://cdn.example/vocal.jpg", video_url: undefined },
            ],
          },
        ],
        rows: [{ label: "Runtime", value: "60 min" }],
      });
    });
  });

  describe("getPdpCustomSpecs", () => {
    it("renders custom spec categories and skips system ones", () => {
      const item = {
        kind: "service",
        item_specs: [
          { name: "Proyección Especial", category: { name: "Detalles Del Evento", is_system: false } },
          { name: "Vocal Selections", category: { name: "Detalles Del Evento", is_system: false } },
          { name: "Studio A", category: { name: "Venue", slug: "venue", is_system: true } },
        ],
        metadata: {
          specs: [{ label: "Runtime", value: "60 min" }],
        },
      } as unknown as CatalogItem;

      expect(getPdpCustomSpecs(item)).toEqual([
        { label: "Detalles Del Evento", value: "Proyección Especial" },
        { label: "Detalles Del Evento", value: "Vocal Selections" },
        { label: "Runtime", value: "60 min" },
      ]);
    });
  });

  describe("getPdpFilledAttributeFields", () => {
    it("returns only filled attribute fields for the item kind", () => {
      const item = {
        kind: "service",
        metadata: {
          attributes: { duration: "60 min", level: "  ", language: "Spanish" },
        },
      } as unknown as CatalogItem;

      expect(getPdpFilledAttributeFields(item)).toEqual(["duration", "language"]);
    });
  });

  describe("getListingCtaLabel owned access", () => {
    const ticket = { kind: "digital_asset", digital_subtype: "ticket" } as CatalogItem
    const pass = { kind: "digital_asset", digital_subtype: "pass" } as CatalogItem

    it("uses View Ticket for an owned ticket", () => {
      expect(getListingCtaLabel(ticket, { isOwned: true })).toBe("buyer.library.actions.ticket")
    })

    it("keeps Book for an owned pass that can book", () => {
      expect(getListingCtaLabel(pass, { isOwned: true, canBook: true })).toBe("marketplace.listing.cta.book")
    })

    it("keeps Get Tickets for an unowned ticket", () => {
      expect(getListingCtaLabel(ticket)).toBe("marketplace.listing.cta.getTickets")
    })
  })
});
