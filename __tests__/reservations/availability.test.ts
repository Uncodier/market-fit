import { getBookedSeats, getAvailableSlots, assertReservationSlot } from '../../app/reservations/availability';
import { addDays, addMinutes, format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

function createChain(resolved: any) {
  const chain: any = {};
  const methods = ['from', 'select', 'eq', 'in', 'gte', 'lte', 'neq', 'single'];
  for (const m of methods) {
    chain[m] = jest.fn(() => chain);
  }
  chain.then = (resolve: any, reject: any) => Promise.resolve(resolved).then(resolve, reject);
  return chain;
}

const mockCreateServiceClient = jest.fn();

jest.mock('../../lib/supabase/server', () => ({
  createServiceClient: (...args: any[]) => mockCreateServiceClient(...args),
}));

describe('Reservation Availability Engine', () => {
  const catalogItemId = 'cat-123';
  const siteId = 'site-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBookedSeats', () => {
    it('should sum quantities of overlapping reservations', async () => {
      const start = fromZonedTime('2026-07-25T10:00:00', 'UTC');
      const end = fromZonedTime('2026-07-25T11:00:00', 'UTC');
      const client = createChain({
        data: [
          { quantity: 2, status: 'confirmed' },
          { quantity: 1, status: 'pending' },
        ],
        error: null,
      });

      const seats = await getBookedSeats(catalogItemId, start, end, client);
      expect(seats).toBe(3);
      expect(client.from).toHaveBeenCalledWith('reservations');
    });

    it('should return 0 if no overlapping reservations', async () => {
      const start = fromZonedTime('2026-07-25T10:00:00', 'UTC');
      const end = fromZonedTime('2026-07-25T11:00:00', 'UTC');
      const client = createChain({ data: [], error: null });

      const seats = await getBookedSeats(catalogItemId, start, end, client);
      expect(seats).toBe(0);
    });
  });

  describe('getAvailableSlots', () => {
    it('should generate slots based on schedule and booked seats', async () => {
      const tomorrow = addDays(new Date(), 1);
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
      const dayOfWeek = format(tomorrow, 'eeee').toLowerCase();
      const timeZone = 'UTC';

      const slot1Start = fromZonedTime(`${tomorrowStr}T10:00:00`, timeZone);
      const slot1End = addMinutes(slot1Start, 60);

      const schedulesChain = createChain({
        data: [{
          catalog_item_id: catalogItemId,
          duration_minutes: 60,
          capacity: 5,
          timezone: timeZone,
          days: {
            [dayOfWeek]: { enabled: true, start: '10:00', end: '12:00' }
          }
        }],
      });
      const reservationsChain = createChain({
        data: [
          { start_time: slot1Start.toISOString(), end_time: slot1End.toISOString(), quantity: 2, status: 'confirmed' }
        ],
      });

      mockCreateServiceClient.mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table === 'reservation_schedules') return schedulesChain;
          return reservationsChain;
        }),
      });

      const slots = await getAvailableSlots(catalogItemId, tomorrowStr, tomorrowStr, 1);

      expect(slots).toHaveLength(2); // 10:00 to 11:00, and 11:00 to 12:00
      expect(slots[0].available).toBe(3); // 5 capacity - 2 booked
      expect(slots[1].available).toBe(5); // 5 capacity - 0 booked
    });

    it('should ignore the reservation being edited when counting booked seats', async () => {
      const tomorrow = addDays(new Date(), 1);
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
      const dayOfWeek = format(tomorrow, 'eeee').toLowerCase();
      const timeZone = 'UTC';
      const slot1Start = fromZonedTime(`${tomorrowStr}T10:00:00`, timeZone);
      const slot1End = addMinutes(slot1Start, 60);

      const schedulesChain = createChain({
        data: [{
          catalog_item_id: catalogItemId,
          duration_minutes: 60,
          capacity: 2,
          timezone: timeZone,
          days: {
            [dayOfWeek]: { enabled: true, start: '10:00', end: '11:00' }
          }
        }],
      });
      const reservationsChain = createChain({
        data: [
          { id: 'res-edit', start_time: slot1Start.toISOString(), end_time: slot1End.toISOString(), quantity: 2, status: 'confirmed' }
        ],
      });

      mockCreateServiceClient.mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table === 'reservation_schedules') return schedulesChain;
          return reservationsChain;
        }),
      });

      const withoutIgnore = await getAvailableSlots(catalogItemId, tomorrowStr, tomorrowStr, 1);
      expect(withoutIgnore).toHaveLength(0);

      const withIgnore = await getAvailableSlots(catalogItemId, tomorrowStr, tomorrowStr, 1, 'res-edit');
      expect(withIgnore).toHaveLength(1);
      expect(withIgnore[0].available).toBe(2);
    });

    it('should interpret schedule hours in the schedule timezone (not server local/UTC)', async () => {
      // Pick a Wednesday far enough in the future
      const wednesday = new Date('2026-08-12T12:00:00Z');
      const dateStr = '2026-08-12';
      const timeZone = 'America/Mexico_City';

      const schedulesChain = createChain({
        data: [{
          catalog_item_id: catalogItemId,
          duration_minutes: 60,
          capacity: 10,
          timezone: timeZone,
          days: {
            wednesday: { enabled: true, start: '19:00', end: '20:00' }
          }
        }],
      });
      const reservationsChain = createChain({ data: [] });

      mockCreateServiceClient.mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table === 'reservation_schedules') return schedulesChain;
          return reservationsChain;
        }),
      });

      // Freeze "now" before the slot
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T12:00:00Z'));

      const slots = await getAvailableSlots(catalogItemId, dateStr, dateStr, 1);

      jest.useRealTimers();

      expect(slots).toHaveLength(1);
      // 19:00 America/Mexico_City (UTC-6) => 01:00 UTC next day
      expect(slots[0].start).toBe(fromZonedTime(`${dateStr}T19:00:00`, timeZone).toISOString());
      expect(slots[0].end).toBe(fromZonedTime(`${dateStr}T20:00:00`, timeZone).toISOString());
      // Ensure we did NOT treat 19:00 as UTC (which would display as 1pm in Mexico)
      expect(slots[0].start).not.toBe(`${dateStr}T19:00:00.000Z`);
      expect(wednesday.getUTCDay()).toBe(3); // sanity: Aug 12 2026 is Wednesday
    });
  });

  describe('assertReservationSlot', () => {
    it('should throw if no schedule configured', async () => {
      mockCreateServiceClient.mockResolvedValue({
        from: jest.fn(() => createChain({ data: null })),
      });
      
      await expect(
        assertReservationSlot(siteId, catalogItemId, new Date().toISOString(), new Date().toISOString(), 1)
      ).rejects.toThrow('Item is reservable but has no schedule configured');
    });

    it('should throw if booking in the past', async () => {
      mockCreateServiceClient.mockResolvedValue({
        from: jest.fn(() => createChain({ data: [{ days: {}, timezone: 'UTC' }] })),
      });
      const past = addDays(new Date(), -1).toISOString();
      
      await expect(
        assertReservationSlot(siteId, catalogItemId, past, past, 1)
      ).rejects.toThrow('Cannot book in the past');
    });

    it('should pass if valid and sufficient capacity', async () => {
      const tomorrow = addDays(new Date(), 1);
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
      const dayOfWeek = format(tomorrow, 'eeee').toLowerCase();
      const timeZone = 'UTC';

      const start = fromZonedTime(`${tomorrowStr}T10:00:00`, timeZone);
      const end = addMinutes(start, 60);

      const schedulesChain = createChain({
        data: [{
          capacity: 10,
          timezone: timeZone,
          days: {
            [dayOfWeek]: { enabled: true, start: '09:00', end: '17:00' }
          }
        }],
      });
      const bookedChain = createChain({ data: [] });

      mockCreateServiceClient.mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table === 'reservation_schedules') return schedulesChain;
          return bookedChain;
        }),
      });

      await expect(
        assertReservationSlot(siteId, catalogItemId, start.toISOString(), end.toISOString(), 2)
      ).resolves.toBe(true);
    });

    it('should throw if insufficient capacity', async () => {
      const tomorrow = addDays(new Date(), 1);
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
      const dayOfWeek = format(tomorrow, 'eeee').toLowerCase();
      const timeZone = 'UTC';

      const start = fromZonedTime(`${tomorrowStr}T10:00:00`, timeZone);
      const end = addMinutes(start, 60);

      const schedulesChain = createChain({
        data: [{
          capacity: 2,
          timezone: timeZone,
          days: {
            [dayOfWeek]: { enabled: true, start: '09:00', end: '17:00' }
          }
        }],
      });
      const bookedChain = createChain({
        data: [{ quantity: 2, status: 'confirmed' }],
      });

      mockCreateServiceClient.mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table === 'reservation_schedules') return schedulesChain;
          return bookedChain;
        }),
      });

      await expect(
        assertReservationSlot(siteId, catalogItemId, start.toISOString(), end.toISOString(), 1)
      ).rejects.toThrow('Not enough capacity for this slot');
    });

    it('should validate slots using the schedule timezone', async () => {
      const dateStr = '2026-08-12';
      const timeZone = 'America/Mexico_City';
      const start = fromZonedTime(`${dateStr}T19:00:00`, timeZone);
      const end = fromZonedTime(`${dateStr}T20:00:00`, timeZone);

      const schedulesChain = createChain({
        data: [{
          capacity: 10,
          timezone: timeZone,
          days: {
            wednesday: { enabled: true, start: '19:00', end: '20:00' }
          }
        }],
      });
      const bookedChain = createChain({ data: [] });

      mockCreateServiceClient.mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table === 'reservation_schedules') return schedulesChain;
          return bookedChain;
        }),
      });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T12:00:00Z'));

      await expect(
        assertReservationSlot(siteId, catalogItemId, start.toISOString(), end.toISOString(), 1)
      ).resolves.toBe(true);

      jest.useRealTimers();
    });
  });
});
