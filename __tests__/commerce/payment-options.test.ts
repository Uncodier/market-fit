import { 
  getItemPaymentOptions, 
  intersectPaymentOptions, 
  getAvailablePaymentMethods
} from '../../app/commerce/payment-options';
import { CatalogItem } from '../../app/types';

describe('payment-options', () => {
  describe('getItemPaymentOptions', () => {
    it('returns metadata options if set', () => {
      const item: Partial<CatalogItem> = {
        metadata: { payment_options: ['cash_on_pickup'] }
      };
      expect(getItemPaymentOptions(item)).toEqual(['cash_on_pickup']);
    });

    it('returns default site options if metadata is empty', () => {
      const item: Partial<CatalogItem> = {};
      expect(getItemPaymentOptions(item)).toEqual(['card', 'cash_on_pickup']);
    });

    it('returns custom site options if provided', () => {
      const item: Partial<CatalogItem> = {};
      expect(getItemPaymentOptions(item, ['card'])).toEqual(['card']);
    });
  });

  describe('intersectPaymentOptions', () => {
    it('returns full intersection if all methods allowed', () => {
      const items = [
        { allowed: ['card', 'cash_on_pickup', 'bank_transfer'] as const },
        { allowed: ['card', 'cash_on_pickup', 'bank_transfer'] as const }
      ];
      expect(intersectPaymentOptions(items)).toEqual(['card', 'cash_on_pickup', 'bank_transfer']);
    });

    it('returns empty array if no intersection', () => {
      const items = [
        { allowed: ['card'] as const },
        { allowed: ['cash_on_pickup'] as const }
      ];
      expect(intersectPaymentOptions(items)).toEqual([]);
    });

    it('returns common method', () => {
      const items = [
        { allowed: ['card', 'cash_on_pickup'] as const },
        { allowed: ['card'] as const }
      ];
      expect(intersectPaymentOptions(items)).toEqual(['card']);
    });
  });

  describe('getAvailablePaymentMethods', () => {
    it('allows cash_on_pickup for pickup if allowed', () => {
      expect(getAvailablePaymentMethods('pickup', ['card', 'cash_on_pickup'])).toEqual(['card', 'cash_on_pickup']);
    });

    it('allows cash_on_pickup for dine_in if allowed', () => {
      expect(getAvailablePaymentMethods('dine_in', ['card', 'cash_on_pickup'])).toEqual(['card', 'cash_on_pickup']);
    });

    it('removes cash_on_pickup for ship even if allowed globally (when no service items)', () => {
      expect(getAvailablePaymentMethods('ship', ['card', 'cash_on_pickup'], [{ kind: 'product' }])).toEqual(['card']);
    });

    it('allows cash_on_pickup for ship if there are service items', () => {
      expect(getAvailablePaymentMethods('ship', ['card', 'cash_on_pickup'], [{ kind: 'service' }])).toEqual(['card', 'cash_on_pickup']);
    });

    it('allows cash_on_pickup for none if there are reservable items', () => {
      expect(getAvailablePaymentMethods('none', ['card', 'cash_on_pickup'], [{ kind: 'product', is_reservation: true }])).toEqual(['card', 'cash_on_pickup']);
    });

    it('allows bank_transfer for any fulfillment', () => {
      expect(getAvailablePaymentMethods('ship', ['card', 'bank_transfer'])).toEqual(['card', 'bank_transfer']);
      expect(getAvailablePaymentMethods('none', ['bank_transfer'])).toEqual(['bank_transfer']);
    });

    it('returns empty array if no valid options left', () => {
      expect(getAvailablePaymentMethods('ship', ['cash_on_pickup'])).toEqual([]);
    });
  });
});
