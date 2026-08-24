import {
  shouldShowShopLocationPill,
  isItemLocationAvailable,
  isBuyerLocationIncompatible,
  formatBuyerLocationLabel,
  buyerMatchesSiteLocations,
  isBuyerParticularlyClose,
  pickPreferredPickupLocation,
  haversineKm,
  NEARBY_PICKUP_METERS,
} from '@/app/commerce/buyer-location-availability';

describe('buyer-location-availability', () => {
  describe('shouldShowShopLocationPill', () => {
    it('shows when multiple inventory locations', () => {
      expect(
        shouldShowShopLocationPill({
          inventoryLocations: [
            { id: 'a', is_active: true },
            { id: 'b', is_active: true },
          ],
          settingsLocations: [],
          buyerGeo: { city: 'Austin', country: 'US' },
        })
      ).toBe(true);
    });

    it('hides when single store and no settings restrictions', () => {
      expect(
        shouldShowShopLocationPill({
          inventoryLocations: [{ id: 'a', is_active: true }],
          settingsLocations: [],
          buyerGeo: { city: 'Austin', country: 'US' },
        })
      ).toBe(false);
    });

    it('hides when geo available in same allowed city', () => {
      expect(
        shouldShowShopLocationPill({
          inventoryLocations: [{ id: 'a', is_active: true }],
          settingsLocations: [
            {
              restrictions: {
                enabled: true,
                included_addresses: [{ city: 'Austin', country: 'US' }],
              },
            },
          ],
          buyerGeo: { city: 'Austin', country: 'US' },
        })
      ).toBe(false);
    });

    it('shows when outside service area', () => {
      expect(
        shouldShowShopLocationPill({
          inventoryLocations: [{ id: 'a', is_active: true }],
          settingsLocations: [
            {
              restrictions: {
                enabled: true,
                included_addresses: [{ city: 'Austin', country: 'US' }],
              },
            },
          ],
          buyerGeo: { city: 'Dallas', country: 'US' },
        })
      ).toBe(true);
    });
  });

  describe('isItemLocationAvailable', () => {
    it('blocks by settings geo', () => {
      expect(
        isItemLocationAvailable({
          item: { id: '1' },
          settingsLocations: [
            {
              restrictions: {
                enabled: true,
                included_addresses: [{ country: 'US' }],
              },
            },
          ],
          buyerGeo: { country: 'MX' },
        })
      ).toBe(false);
    });

    it('blocks by pickup location when store selected', () => {
      expect(
        isItemLocationAvailable({
          item: {
            id: '1',
            metadata: { pickup_location_ids: ['store-a'] },
          },
          settingsLocations: [],
          buyerGeo: { city: 'Austin', country: 'US' },
          selectedLocationId: 'store-b',
        })
      ).toBe(false);
    });

    it('allows unrestricted pickup at any selected store', () => {
      expect(
        isItemLocationAvailable({
          item: { id: '1', metadata: { pickup_location_ids: [] } },
          settingsLocations: [],
          buyerGeo: { city: 'Austin', country: 'US' },
          selectedLocationId: 'store-b',
        })
      ).toBe(true);
    });

    it('store selection ignores geo exclusion (branch browse)', () => {
      expect(
        isItemLocationAvailable({
          item: { id: '1', metadata: { pickup_location_ids: [] } },
          settingsLocations: [
            {
              restrictions: {
                enabled: true,
                included_addresses: [{ country: 'US' }],
              },
            },
          ],
          buyerGeo: { country: 'MX' },
          selectedLocationId: 'store-a',
        })
      ).toBe(true);
    });

    it('store selection still respects pickup_location_ids', () => {
      expect(
        isItemLocationAvailable({
          item: { id: '1', metadata: { pickup_location_ids: ['store-b'] } },
          settingsLocations: [],
          buyerGeo: { city: 'Celaya', country: 'MX' },
          selectedLocationId: 'store-a',
        })
      ).toBe(false);
    });
  });

  describe('formatBuyerLocationLabel', () => {
    it('prefers city', () => {
      expect(formatBuyerLocationLabel({ city: 'Austin', country: 'US' })).toBe('Austin');
    });
  });

  describe('buyerMatchesSiteLocations', () => {
    it('matches office city Celaya', () => {
      expect(
        buyerMatchesSiteLocations(
          { city: 'Celaya', country: 'MX' },
          [{ name: 'Celaya', city: 'Celaya', country: 'México' }]
        )
      ).toBe(true);
    });
  });

  describe('isBuyerLocationIncompatible', () => {
    it('is false when buyer city matches inventory location', () => {
      expect(
        isBuyerLocationIncompatible({
          settingsLocations: [
            {
              restrictions: {
                enabled: true,
                included_addresses: [{ city: 'Monterrey', country: 'Mexico' }],
              },
            },
          ],
          inventoryLocations: [{ name: 'Celaya', city: 'Celaya' }],
          buyerGeo: { city: 'Celaya', country: 'MX' },
        })
      ).toBe(false);
    });

    it('is true outside service area with no site presence', () => {
      expect(
        isBuyerLocationIncompatible({
          settingsLocations: [
            {
              restrictions: {
                enabled: true,
                included_addresses: [{ city: 'Monterrey', country: 'Mexico' }],
              },
            },
          ],
          inventoryLocations: [{ name: 'Celaya', city: 'Celaya' }],
          buyerGeo: { city: 'Guadalajara', country: 'MX' },
        })
      ).toBe(true);
    });
  });

  describe('isBuyerParticularlyClose', () => {
    it('is false when only the city matches — that is too coarse to know they can arrive', () => {
      expect(
        isBuyerParticularlyClose({
          buyerGeo: { city: 'Celaya', country: 'MX' },
          inventoryLocations: [{ id: 'a', name: 'Downtown', city: 'Celaya' }],
        })
      ).toBe(false);
    });

    it('is false when only the zip matches', () => {
      expect(
        isBuyerParticularlyClose({
          buyerGeo: { city: 'Austin', zip: '78701' },
          inventoryLocations: [{ id: 'a', name: 'Store', zip: '78701' }],
        })
      ).toBe(false);
    });

    it('is true when the buyer picked a store', () => {
      expect(
        isBuyerParticularlyClose({
          buyerGeo: { city: 'Dallas' },
          inventoryLocations: [{ id: 'a', city: 'Austin' }],
          selectedLocationId: 'a',
        })
      ).toBe(true);
    });

    it('is true when coordinates are within 500m', () => {
      expect(
        isBuyerParticularlyClose({
          buyerGeo: { latitude: '20.5200', longitude: '-100.8100' },
          inventoryLocations: [{ id: 'a', latitude: 20.5225, longitude: -100.81 }],
        })
      ).toBe(true);
    });

    it('is false when coordinates are farther than 500m', () => {
      expect(
        isBuyerParticularlyClose({
          buyerGeo: { latitude: '20.5200', longitude: '-100.8100' },
          inventoryLocations: [{ id: 'a', latitude: 20.53, longitude: -100.81 }],
        })
      ).toBe(false);
    });
  });

  describe('pickPreferredPickupLocation', () => {
    it('prefers the store within 500m over the default', () => {
      const picked = pickPreferredPickupLocation(
        [
          { id: 'default', latitude: 20.53, longitude: -100.81, is_default: true },
          { id: 'local', latitude: 20.5225, longitude: -100.81 },
        ],
        { latitude: '20.5200', longitude: '-100.8100' }
      );
      expect(picked?.id).toBe('local');
    });

    it('falls back to the default store when none are within 500m', () => {
      const picked = pickPreferredPickupLocation(
        [
          { id: 'other', city: 'Leon' },
          { id: 'default', city: 'Monterrey', is_default: true },
        ],
        { city: 'Guadalajara' }
      );
      expect(picked?.id).toBe('default');
    });
  });

  describe('haversineKm', () => {
    it('is roughly zero for the same point', () => {
      expect(haversineKm({ lat: 20.52, lon: -100.81 }, { lat: 20.52, lon: -100.81 })).toBeCloseTo(0, 5);
    });

    it('treats a ~280m hop as within 500m', () => {
      const meters = haversineKm({ lat: 20.52, lon: -100.81 }, { lat: 20.5225, lon: -100.81 }) * 1000;
      expect(meters).toBeLessThan(NEARBY_PICKUP_METERS);
      expect(meters).toBeGreaterThan(200);
    });
  });
});
