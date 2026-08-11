import {
  isBusinessOpen,
  getNextOpenSlot,
  getNextScheduledClose,
  withStoreOpenState,
  BusinessHours,
} from '../../app/commerce/business-hours';

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

  it('isBusinessOpen can ignore force_closed for scheduled slot validation', () => {
    const forced = [{ ...mockHours[0], force_closed: true }];
    const date = new Date('2026-08-03T12:00:00-04:00'); // Monday noon
    expect(isBusinessOpen(forced, date, { ignoreForceClosed: true })).toBe(true);
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

  it('isBusinessOpen respects force_open_until outside schedule', () => {
    const lateDate = new Date('2026-08-03T21:30:00-04:00'); // Monday 9:30pm
    expect(isBusinessOpen(mockHours, lateDate)).toBe(false);

    const until = new Date('2026-08-04T17:00:00-04:00').toISOString(); // Tuesday close
    const forcedOpen = [{ ...mockHours[0], force_open_until: until }];
    expect(isBusinessOpen(forcedOpen, lateDate)).toBe(true);

    const afterUntil = new Date('2026-08-04T17:30:00-04:00');
    expect(isBusinessOpen(forcedOpen, afterUntil)).toBe(false);
  });

  it('getNextScheduledClose returns today end while still before close', () => {
    const noon = new Date('2026-08-03T12:00:00-04:00');
    const close = getNextScheduledClose(mockHours, noon);
    expect(close?.toISOString()).toBe(new Date('2026-08-03T17:00:00-04:00').toISOString());
  });

  it('getNextScheduledClose returns next enabled day after hours', () => {
    const late = new Date('2026-08-03T21:30:00-04:00'); // Monday night
    const close = getNextScheduledClose(mockHours, late);
    expect(close?.toISOString()).toBe(new Date('2026-08-04T17:00:00-04:00').toISOString());
  });

  it('withStoreOpenState opens outside hours until next scheduled close', () => {
    const late = new Date('2026-08-03T21:30:00-04:00');
    const next = withStoreOpenState(mockHours, true, late);
    expect(next[0].force_closed).toBe(false);
    expect(next[0].force_open_until).toBe(new Date('2026-08-04T17:00:00-04:00').toISOString());
    expect(isBusinessOpen(next, late)).toBe(true);
  });

  it('withStoreOpenState closes outside hours without force_closed', () => {
    const late = new Date('2026-08-03T21:30:00-04:00');
    const open = withStoreOpenState(mockHours, true, late);
    const closed = withStoreOpenState(open, false, late);
    expect(closed[0].force_open_until).toBeNull();
    expect(closed[0].force_closed).toBe(false);
    expect(isBusinessOpen(closed, late)).toBe(false);
  });

  it('withStoreOpenState force-closes during schedule hours', () => {
    const noon = new Date('2026-08-03T12:00:00-04:00');
    const closed = withStoreOpenState(mockHours, false, noon);
    expect(closed[0].force_closed).toBe(true);
    expect(closed[0].force_open_until).toBeNull();
    expect(isBusinessOpen(closed, noon)).toBe(false);
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
