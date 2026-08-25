import {
  getItemDeliveryOptions,
  isItemCompatibleWithFulfillment,
  intersectDeliveryOptions,
  hasMixedCartShippingWarning,
  defaultFulfillment,
  isFulfillmentAllowed,
  intersectPickupLocationIds,
  itemHasDelivery,
  resolveOrderShippingCost,
  withPosFulfillmentOptions,
  POS_ALWAYS_ALLOWED_FULFILLMENTS,
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

    it('defaults to pickup, ship and dine_in for product kind when missing', () => {
      const item: Partial<CatalogItem> = { kind: 'product' };
      expect(getItemDeliveryOptions(item)).toEqual(['pickup', 'ship', 'dine_in']);
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

  describe('isItemCompatibleWithFulfillment', () => {
    it('keeps unconfigured services visible for every order type', () => {
      const item: Partial<CatalogItem> = { kind: 'service' };
      expect(isItemCompatibleWithFulfillment(item, 'ship')).toBe(true);
      expect(isItemCompatibleWithFulfillment(item, 'pickup')).toBe(true);
      expect(isItemCompatibleWithFulfillment(item, 'dine_in')).toBe(true);
    });

    it('keeps unconfigured products visible for every order type', () => {
      const item: Partial<CatalogItem> = { kind: 'product' };
      expect(isItemCompatibleWithFulfillment(item, 'ship')).toBe(true);
      expect(isItemCompatibleWithFulfillment(item, 'dine_in')).toBe(true);
    });

    it('keeps explicit virtual-only items visible when delivery is selected', () => {
      const item: Partial<CatalogItem> = {
        kind: 'service',
        metadata: { delivery_options: ['none'] },
      };
      expect(isItemCompatibleWithFulfillment(item, 'ship')).toBe(true);
      expect(isItemCompatibleWithFulfillment(item, 'pickup')).toBe(true);
    });

    it('hides items that explicitly exclude the selected order type', () => {
      const item: Partial<CatalogItem> = {
        kind: 'product',
        metadata: { delivery_options: ['pickup', 'ship'] },
      };
      expect(isItemCompatibleWithFulfillment(item, 'dine_in')).toBe(false);
      expect(isItemCompatibleWithFulfillment(item, 'ship')).toBe(true);
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

    it('returns restricted options for mixed cart (virtual + physical)', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['pickup', 'ship'] },
        { allowed: ['none'] },
      ];
      // Mixed cart physical intersection is ['pickup', 'ship']
      // Restricts to in-person: ['pickup']
      expect(intersectDeliveryOptions(items)).toEqual(['pickup']);
    });

    it('returns empty when there is no intersection and no mixed cart fallback', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['pickup'] },
        { allowed: ['ship'] },
      ];
      expect(intersectDeliveryOptions(items)).toEqual([]);
    });

    it('returns empty when mixed cart physical intersection has no in-person methods', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['ship'] },
        { allowed: ['none'] },
      ];
      // Mixed cart physical intersection is ['ship']
      // Restricted to in-person: []
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

  describe('hasMixedCartShippingWarning', () => {
    it('returns true when physical items would allow ship but virtual items restrict it', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['pickup', 'ship'] },
        { allowed: ['none'] },
      ];
      expect(hasMixedCartShippingWarning(items)).toBe(true);
    });

    it('returns false when physical items do not allow ship anyway', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['pickup'] },
        { allowed: ['none'] },
      ];
      expect(hasMixedCartShippingWarning(items)).toBe(false);
    });

    it('returns false for pure virtual carts', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['none'] },
      ];
      expect(hasMixedCartShippingWarning(items)).toBe(false);
    });

    it('returns false for pure physical carts', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['pickup', 'ship'] },
      ];
      expect(hasMixedCartShippingWarning(items)).toBe(false);
    });
  });

  describe('defaultFulfillment', () => {
    it('prefers ship', () => {
      expect(defaultFulfillment(['pickup', 'ship', 'none', 'dine_in'])).toEqual('ship');
    });

    it('prefers pickup over ship when nearby', () => {
      expect(defaultFulfillment(['pickup', 'ship', 'none'], { preferPickup: true })).toEqual('pickup');
    });

    it('keeps ship when nearby but pickup is not allowed', () => {
      expect(defaultFulfillment(['ship', 'none'], { preferPickup: true })).toEqual('ship');
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

    it('rejects dine_in when items only allow pickup/ship', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['pickup', 'ship'] },
      ];
      expect(isFulfillmentAllowed('dine_in', items)).toBe(false);
    });

    it('allows dine_in for POS extras even when catalog items omit it', () => {
      const items: { allowed: CheckoutFulfillmentMethod[] }[] = [
        { allowed: ['pickup', 'ship'] },
      ];
      expect(
        isFulfillmentAllowed('dine_in', items, POS_ALWAYS_ALLOWED_FULFILLMENTS)
      ).toBe(true);
      expect(
        isFulfillmentAllowed('none', items, POS_ALWAYS_ALLOWED_FULFILLMENTS)
      ).toBe(true);
      expect(
        isFulfillmentAllowed('ship', items, POS_ALWAYS_ALLOWED_FULFILLMENTS)
      ).toBe(true);
    });
  });

  describe('withPosFulfillmentOptions', () => {
    it('always includes dine_in and none', () => {
      expect(withPosFulfillmentOptions([])).toEqual(
        expect.arrayContaining(['dine_in', 'none'])
      );
      expect(withPosFulfillmentOptions(['pickup', 'ship'])).toEqual(
        expect.arrayContaining(['pickup', 'ship', 'dine_in', 'none'])
      );
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

  describe('resolveOrderShippingCost', () => {
    it('returns 0 when fulfillment is not ship', () => {
      expect(resolveOrderShippingCost('pickup', 100, null, 50, [])).toBe(0);
      expect(resolveOrderShippingCost('dine_in', 100, null, 50, [])).toBe(0);
      expect(resolveOrderShippingCost('none', 100, null, 50, [])).toBe(0);
    });

    it('returns 0 when free shipping threshold is met', () => {
      expect(resolveOrderShippingCost('ship', 100, 50, 25, [])).toBe(0);
    });

    it('uses global site shipping when no product overrides', () => {
      expect(resolveOrderShippingCost('ship', 40, 50, 25, [{ kind: 'product' }])).toBe(25);
    });

    it('adds extra on top of global', () => {
      const items: Partial<CatalogItem>[] = [
        { metadata: { shipping_cost: 10, shipping_cost_mode: 'extra' } },
      ];
      expect(resolveOrderShippingCost('ship', 40, null, 50, items)).toBe(60);
    });

    it('covers_order replaces global', () => {
      const items: Partial<CatalogItem>[] = [
        { metadata: { shipping_cost: 80, shipping_cost_mode: 'covers_order' } },
      ];
      expect(resolveOrderShippingCost('ship', 40, null, 50, items)).toBe(80);
    });

    it('covers_order max plus extras', () => {
      const items: Partial<CatalogItem>[] = [
        { metadata: { shipping_cost: 10, shipping_cost_mode: 'extra' } },
        { metadata: { shipping_cost: 80, shipping_cost_mode: 'covers_order' } },
      ];
      expect(resolveOrderShippingCost('ship', 40, null, 50, items)).toBe(90);
    });

    it('uses max of multiple covers_order amounts', () => {
      const items: Partial<CatalogItem>[] = [
        { metadata: { shipping_cost: 40, shipping_cost_mode: 'covers_order' } },
        { metadata: { shipping_cost: 80, shipping_cost_mode: 'covers_order' } },
      ];
      expect(resolveOrderShippingCost('ship', 40, null, 50, items)).toBe(80);
    });

    it('treats explicit null shipping_cost as zero contribution', () => {
      const items: Partial<CatalogItem>[] = [
        { metadata: { shipping_cost: null, shipping_cost_mode: 'covers_order' } },
      ];
      expect(resolveOrderShippingCost('ship', 40, null, 50, items)).toBe(0);
    });
  });
});
