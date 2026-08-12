import {
  shouldShowShopLocationPill,
  isItemLocationAvailable,
  isBuyerLocationIncompatible,
  formatBuyerLocationLabel,
  buyerMatchesSiteLocations,
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
});
