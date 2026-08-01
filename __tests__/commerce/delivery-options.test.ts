import {
  getItemDeliveryOptions,
  intersectDeliveryOptions,
  defaultFulfillment,
  isFulfillmentAllowed,
  intersectPickupLocationIds,
  itemHasDelivery,
  CheckoutFulfillmentMethod
} from '../../app/commerce/delivery-options';
import { CatalogItem } from '../../app/types';

describe('delivery-options helpers', () => {
  describe('getItemDeliveryOptions', () => {
    it('uses configured options when present', () => {
      const item: Partial<CatalogItem> = {
        kind: 'product',
        metadata: {
          delivery_options: ['pickup']
        }
      };
      expect(getItemDeliveryOptions(item)).toEqual(['pickup']);
    });

    it('defaults to pickup and ship for product kind when missing', () => {
      const item: Partial<CatalogItem> = { kind: 'product' };
      expect(getItemDeliveryOptions(item)).toEqual(['pickup', 'ship']);
    });

    it('defaults to none for digital_asset kind when missing', () => {
      const item: Partial<CatalogItem> = { kind: 'digital_asset' };
      expect(getItemDeliveryOptions(item)).toEqual(['none']);
    });

    it('defaults to none for service kind when missing', () => {
      const item: Partial<CatalogItem> = { kind: 'service' };
      expect(getItemDeliveryOptions(item)).toEqual(['none']);
    });
  });

  describe('intersectDeliveryOptions', () => {
    it('returns empty for empty cart', () => {
      expect(intersectDeliveryOptions([])).toEqual([]);
    });

    it('finds common options across items', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['pickup', 'ship'] },
        { allowed: ['pickup', 'none'] },
      ];
      expect(intersectDeliveryOptions(items)).toEqual(['pickup']);
    });

    it('returns empty when there is no intersection', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['ship'] },
        { allowed: ['none'] },
      ];
      expect(intersectDeliveryOptions(items)).toEqual([]);
    });

    it('returns all when all allow everything', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['pickup', 'ship', 'none', 'dine_in'] },
        { allowed: ['pickup', 'ship', 'none', 'dine_in'] },
      ];
      expect(intersectDeliveryOptions(items)).toEqual(['pickup', 'ship', 'none', 'dine_in']);
    });
  });

  describe('defaultFulfillment', () => {
    it('prefers ship', () => {
      expect(defaultFulfillment(['pickup', 'ship', 'none', 'dine_in'])).toEqual('ship');
    });

    it('prefers pickup over dine_in', () => {
      expect(defaultFulfillment(['pickup', 'dine_in', 'none'])).toEqual('pickup');
    });

    it('prefers dine_in over none', () => {
      expect(defaultFulfillment(['dine_in', 'none'])).toEqual('dine_in');
    });

    it('returns none if only none', () => {
      expect(defaultFulfillment(['none'])).toEqual('none');
    });

    it('returns undefined for empty', () => {
      expect(defaultFulfillment([])).toBeUndefined();
    });
  });

  describe('isFulfillmentAllowed', () => {
    it('returns true when method is in intersection', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['pickup', 'ship'] },
        { allowed: ['ship'] },
      ];
      expect(isFulfillmentAllowed('ship', items)).toBe(true);
    });

    it('returns false when method is not in intersection', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['pickup', 'ship'] },
        { allowed: ['pickup'] },
      ];
      expect(isFulfillmentAllowed('ship', items)).toBe(false);
    });
  });

  describe('itemHasDelivery', () => {
    it('is true when pickup or ship is allowed', () => {
      expect(itemHasDelivery({ kind: 'product' })).toBe(true);
      expect(itemHasDelivery({ kind: 'digital_asset' })).toBe(false);
    });
  });

  describe('intersectPickupLocationIds', () => {
    it('returns null when no pickup restrictions', () => {
      const items: Partial<CatalogItem>[] = [
        { metadata: { delivery_options: ['pickup'] } },
        { metadata: { delivery_options: ['pickup', 'ship'] } },
      ];
      expect(intersectPickupLocationIds(items)).toBeNull();
    });

    it('intersects restricted location lists', () => {
      const items: Partial<CatalogItem>[] = [
        { metadata: { delivery_options: ['pickup'], pickup_location_ids: ['a', 'b'] } },
        { metadata: { delivery_options: ['pickup'], pickup_location_ids: ['b', 'c'] } },
      ];
      expect(intersectPickupLocationIds(items)).toEqual(['b']);
    });

    it('returns empty when restrictions conflict', () => {
      const items: Partial<CatalogItem>[] = [
        { metadata: { delivery_options: ['pickup'], pickup_location_ids: ['a'] } },
        { metadata: { delivery_options: ['pickup'], pickup_location_ids: ['b'] } },
      ];
      expect(intersectPickupLocationIds(items)).toEqual([]);
    });

    it('ignores unrestricted items when intersecting', () => {
      const items: Partial<CatalogItem>[] = [
        { metadata: { delivery_options: ['pickup'], pickup_location_ids: ['a', 'b'] } },
        { metadata: { delivery_options: ['pickup'] } },
      ];
      expect(intersectPickupLocationIds(items)).toEqual(['a', 'b']);
    });
  });
});
