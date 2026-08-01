import { getBookedSeats, getAvailableSlots, assertReservationSlot } from '../../app/reservations/availability';
import { addDays, parseISO, startOfDay, addMinutes, format } from 'date-fns';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('../../lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

describe('Reservation Availability Engine', () => {
  const catalogItemId = 'cat-123';
  const siteId = 'site-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBookedSeats', () => {
    it('should sum quantities of overlapping reservations', async () => {
      const start = parseISO('2026-07-25T10:00:00Z');
      const end = parseISO('2026-07-25T11:00:00Z');

      mockSupabase.lte.mockResolvedValueOnce({
        data: [
          { quantity: 2, status: 'confirmed' },
          { quantity: 1, status: 'pending' },
        ],
        error: null,
      });

      const seats = await getBookedSeats(catalogItemId, start, end, mockSupabase);
      expect(seats).toBe(3);
      expect(mockSupabase.from).toHaveBeenCalledWith('reservations');
    });

    it('should return 0 if no overlapping reservations', async () => {
      const start = parseISO('2026-07-25T10:00:00Z');
      const end = parseISO('2026-07-25T11:00:00Z');

      mockSupabase.lte.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const seats = await getBookedSeats(catalogItemId, start, end, mockSupabase);
      expect(seats).toBe(0);
    });
  });

  describe('getAvailableSlots', () => {
    it('should generate slots based on schedule and booked seats', async () => {
      const today = new Date();
      // Ensure the test uses a future date to avoid "past date" filtering
      const tomorrow = addDays(today, 1);
      const tomorrowStr = tomorrow.toISOString();
      const dayOfWeek = format(tomorrow, "eeee").toLowerCase();

      // Mock schedule
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          catalog_item_id: catalogItemId,
          duration_minutes: 60,
          capacity: 5,
          days: {
            [dayOfWeek]: { enabled: true, start: '10:00', end: '12:00' }
          }
        }
      });

      // Mock reservations (1 booking of 2 seats at 10:00)
      const slot1Start = new Date(tomorrow);
      slot1Start.setHours(10, 0, 0, 0);
      const slot1End = addMinutes(slot1Start, 60);
      
      mockSupabase.lte.mockResolvedValueOnce({
        data: [
          { start_time: slot1Start.toISOString(), end_time: slot1End.toISOString(), quantity: 2, status: 'confirmed' }
        ]
      });

      const slots = await getAvailableSlots(catalogItemId, tomorrowStr, tomorrowStr, 1);

      expect(slots).toHaveLength(2); // 10:00 to 11:00, and 11:00 to 12:00
      expect(slots[0].available).toBe(3); // 5 capacity - 2 booked
      expect(slots[1].available).toBe(5); // 5 capacity - 0 booked
    });
  });

  describe('assertReservationSlot', () => {
    it('should throw if no schedule configured', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: null });
      
      await expect(
        assertReservationSlot(siteId, catalogItemId, new Date().toISOString(), new Date().toISOString(), 1)
      ).rejects.toThrow('Item is reservable but has no schedule configured');
    });

    it('should throw if booking in the past', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { days: {} } });
      const past = addDays(new Date(), -1).toISOString();
      
      await expect(
        assertReservationSlot(siteId, catalogItemId, past, past, 1)
      ).rejects.toThrow('Cannot book in the past');
    });

    it('should pass if valid and sufficient capacity', async () => {
      const tomorrow = addDays(new Date(), 1);
      const dayOfWeek = format(tomorrow, "eeee").toLowerCase();
      
      const start = new Date(tomorrow);
      start.setHours(10, 0, 0, 0);
      const end = addMinutes(start, 60);

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          capacity: 10,
          days: {
            [dayOfWeek]: { enabled: true, start: '09:00', end: '17:00' }
          }
        }
      });

      // getBookedSeats mock return 0
      mockSupabase.lte.mockResolvedValueOnce({ data: [] });

      await expect(
        assertReservationSlot(siteId, catalogItemId, start.toISOString(), end.toISOString(), 2)
      ).resolves.toBe(true);
    });

    it('should throw if insufficient capacity', async () => {
      const tomorrow = addDays(new Date(), 1);
      const dayOfWeek = format(tomorrow, "eeee").toLowerCase();
      
      const start = new Date(tomorrow);
      start.setHours(10, 0, 0, 0);
      const end = addMinutes(start, 60);

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          capacity: 2,
          days: {
            [dayOfWeek]: { enabled: true, start: '09:00', end: '17:00' }
          }
        }
      });

      // getBookedSeats mock return 2 (fully booked)
      mockSupabase.lte.mockResolvedValueOnce({ 
        data: [{ quantity: 2, status: 'confirmed' }] 
      });

      await expect(
        assertReservationSlot(siteId, catalogItemId, start.toISOString(), end.toISOString(), 1)
      ).rejects.toThrow('Not enough capacity for this slot');
    });
  });
});
