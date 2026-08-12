import { evaluateLocationRestrictions } from '../../app/commerce/location-restrictions';

describe('evaluateLocationRestrictions', () => {
  it('allows everything when no locations exist', () => {
    expect(evaluateLocationRestrictions([], { zip: '90210' }).available).toBe(true);
  });

  it('allows everything if buyer location is missing', () => {
    expect(evaluateLocationRestrictions([{ restrictions: { enabled: true, excluded_addresses: [{ zip: '90210' }] } }], {}).available).toBe(true);
  });

  it('blocks if zip is in exclusions', () => {
    const locations = [
      {
        restrictions: {
          enabled: true,
          excluded_addresses: [{ zip: '90210' }]
        }
      }
    ];
    const res = evaluateLocationRestrictions(locations, { zip: '90210' });
    expect(res.available).toBe(false);
    expect(res.reason).toBe('excluded');
  });

  it('allows if zip is not excluded', () => {
    const locations = [
      {
        restrictions: {
          enabled: true,
          excluded_addresses: [{ zip: '90210' }]
        }
      }
    ];
    expect(evaluateLocationRestrictions(locations, { zip: '10001' }).available).toBe(true);
  });

  it('handles "solo trabajo" (included addresses only)', () => {
    const locations = [
      {
        restrictions: {
          enabled: true,
          included_addresses: [{ city: 'Los Angeles' }]
        }
      }
    ];
    
    // Should block non-matching city
    expect(evaluateLocationRestrictions(locations, { city: 'New York' }).available).toBe(false);
    expect(evaluateLocationRestrictions(locations, { city: 'New York' }).reason).toBe('outside_service_area');
    
    // Should allow matching city (case insensitive)
    expect(evaluateLocationRestrictions(locations, { city: 'los angeles' }).available).toBe(true);
  });

  it('ignores blank included address placeholders', () => {
    const locations = [
      {
        restrictions: {
          enabled: true,
          included_addresses: [{ name: '', city: '', country: '' }],
        },
      },
    ];
    expect(
      evaluateLocationRestrictions(locations, { city: 'Celaya', country: 'MX' }).available
    ).toBe(true);
  });

  it('matches ISO country codes to country names', () => {
    const locations = [
      {
        restrictions: {
          enabled: true,
          included_addresses: [{ country: 'Mexico', city: 'Celaya' }],
        },
      },
    ];
    expect(
      evaluateLocationRestrictions(locations, { country: 'MX', city: 'Celaya' }).available
    ).toBe(true);
  });

  it('matches cities ignoring accents', () => {
    const locations = [
      {
        restrictions: {
          enabled: true,
          included_addresses: [{ city: 'Mexico' }],
        },
      },
    ];
    expect(
      evaluateLocationRestrictions(locations, { city: 'México' }).available
    ).toBe(true);
  });

  it('excludes take precedence over includes', () => {
    const locations = [
      {
        restrictions: {
          enabled: true,
          included_addresses: [{ city: 'Los Angeles' }],
          excluded_addresses: [{ zip: '90210' }]
        }
      }
    ];
    
    // Included city but excluded zip -> blocked
    const res = evaluateLocationRestrictions(locations, { city: 'Los Angeles', zip: '90210' });
    expect(res.available).toBe(false);
    expect(res.reason).toBe('excluded');
  });
});
