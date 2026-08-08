import { isBusinessOpen, getNextOpenSlot, BusinessHours } from '../../app/commerce/business-hours';

describe('business-hours', () => {
  const mockHours: BusinessHours[] = [
    {
      name: 'Main',
      timezone: 'America/New_York',
      days: {
        monday: { enabled: true, start: '09:00', end: '17:00' },
        tuesday: { enabled: true, start: '09:00', end: '17:00' },
        wednesday: { enabled: true, start: '09:00', end: '17:00' },
        thursday: { enabled: true, start: '09:00', end: '17:00' },
        friday: { enabled: true, start: '09:00', end: '17:00' },
        saturday: { enabled: false },
        sunday: { enabled: false }
      }
    }
  ];

  it('isBusinessOpen returns true if no hours configured', () => {
    expect(isBusinessOpen()).toBe(true);
    expect(isBusinessOpen([])).toBe(true);
  });

  it('isBusinessOpen respects force_closed flag', () => {
    const forced = [{ ...mockHours[0], force_closed: true }];
    // Even if it's noon on a Monday
    const date = new Date('2026-08-03T12:00:00-04:00'); // Aug 3 2026 is Monday
    expect(isBusinessOpen(forced, date)).toBe(false);
  });

  it('isBusinessOpen checks timezone and time correctly', () => {
    // 10:00 AM NY time (Monday)
    const openDate = new Date('2026-08-03T10:00:00-04:00');
    expect(isBusinessOpen(mockHours, openDate)).toBe(true);

    // 08:00 AM NY time (Monday)
    const earlyDate = new Date('2026-08-03T08:00:00-04:00');
    expect(isBusinessOpen(mockHours, earlyDate)).toBe(false);

    // 18:00 PM NY time (Monday)
    const lateDate = new Date('2026-08-03T18:00:00-04:00');
    expect(isBusinessOpen(mockHours, lateDate)).toBe(false);

    // Saturday
    const satDate = new Date('2026-08-08T12:00:00-04:00');
    expect(isBusinessOpen(mockHours, satDate)).toBe(false);
  });

  it('getNextOpenSlot returns correct slot when checked early in the day', () => {
    const earlyDate = new Date('2026-08-03T08:00:00-04:00'); // Monday 8am
    const next = getNextOpenSlot(mockHours, earlyDate);
    expect(next?.label).toBe('today at 09:00');
    expect(next?.at.getHours()).toBe(9); // Since our local machine could be any timezone, getHours might be local, but it should represent 9am NY
  });

  it('getNextOpenSlot returns tomorrow if checked after hours', () => {
    const lateDate = new Date('2026-08-03T18:00:00-04:00'); // Monday 6pm
    const next = getNextOpenSlot(mockHours, lateDate);
    expect(next?.label).toMatch(/Tuesday at 09:00/i);
  });

  it('getNextOpenSlot skips weekends', () => {
    const lateFriday = new Date('2026-08-07T18:00:00-04:00'); // Friday 6pm
    const next = getNextOpenSlot(mockHours, lateFriday);
    expect(next?.label).toMatch(/Monday at 09:00/i);
  });

  it('getNextOpenSlot localizes labels for Spanish', () => {
    const earlyDate = new Date('2026-08-03T08:00:00-04:00'); // Monday 8am
    const today = getNextOpenSlot(mockHours, earlyDate, 'es');
    expect(today?.label).toBe('hoy a las 09:00');

    const lateFriday = new Date('2026-08-07T18:00:00-04:00'); // Friday 6pm
    const monday = getNextOpenSlot(mockHours, lateFriday, 'es');
    expect(monday?.label).toMatch(/el lunes a las 09:00/i);
  });
});
