import { resolveCheckoutCopyMode, checkoutLabelKey } from '@/app/commerce/checkout-labels';

describe('checkout-labels', () => {
  describe('resolveCheckoutCopyMode', () => {
    it('returns retail for empty cart', () => {
      expect(resolveCheckoutCopyMode([])).toBe('retail');
    });

    it('returns retail for product items', () => {
      expect(resolveCheckoutCopyMode([{ kind: 'product' }])).toBe('retail');
    });

    it('returns service for service items', () => {
      expect(resolveCheckoutCopyMode([{ kind: 'service' }])).toBe('service');
    });

    it('returns service for reservations', () => {
      expect(resolveCheckoutCopyMode([{ is_reservation: true }])).toBe('service');
    });

    it('returns service for multiple service/reservation items', () => {
      expect(resolveCheckoutCopyMode([
        { kind: 'service' }, 
        { kind: 'product', is_reservation: true }
      ])).toBe('service');
    });

    it('returns retail for mixed carts', () => {
      expect(resolveCheckoutCopyMode([{ kind: 'service' }, { kind: 'product' }])).toBe('retail');
    });
  });

  describe('checkoutLabelKey', () => {
    it('appends Service for service mode', () => {
      expect(checkoutLabelKey('some.key', 'service')).toBe('some.keyService');
    });

    it('returns baseKey for retail mode', () => {
      expect(checkoutLabelKey('some.key', 'retail')).toBe('some.key');
    });
  });
});
