import { grantFromOrder } from '@/app/commerce/entitlements';
import { createClient, createServiceClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn()
}));

describe('Entitlements Service', () => {
  it('should be defined', () => {
    expect(grantFromOrder).toBeDefined();
  });
});
