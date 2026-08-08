import { formatInTimeZone, toDate } from 'date-fns-tz';
import { addDays, parseISO, startOfDay, isBefore, isAfter, setHours, setMinutes } from 'date-fns';

export interface BusinessHours {
  name: string
  timezone: string
  respectHolidays?: boolean
  force_closed?: boolean
  days: {
    monday: { enabled: boolean; start?: string; end?: string }
    tuesday: { enabled: boolean; start?: string; end?: string }
    wednesday: { enabled: boolean; start?: string; end?: string }
    thursday: { enabled: boolean; start?: string; end?: string }
    friday: { enabled: boolean; start?: string; end?: string }
    saturday: { enabled: boolean; start?: string; end?: string }
    sunday: { enabled: boolean; start?: string; end?: string }
  }
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export function isBusinessOpen(businessHours?: BusinessHours[], now: Date = new Date()): boolean {
  if (!businessHours || businessHours.length === 0) return true;

  const bh = businessHours[0];
  if (bh.force_closed) return false;
  if (!bh.timezone) return true;

  try {
    const tzDate = toDate(now, { timeZone: bh.timezone });
    const dayOfWeek = DAYS[tzDate.getDay()];
    const dayConfig = bh.days[dayOfWeek as keyof BusinessHours['days']];

    if (!dayConfig || !dayConfig.enabled || !dayConfig.start || !dayConfig.end) {
      return false;
    }

    const [startH, startM] = dayConfig.start.split(':').map(Number);
    const [endH, endM] = dayConfig.end.split(':').map(Number);

    const minutesSinceMidnight = tzDate.getHours() * 60 + tzDate.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return minutesSinceMidnight >= startMinutes && minutesSinceMidnight < endMinutes;
  } catch (err) {
    console.error('Error computing business hours', err);
    return true; // fallback to open
  }
}

export function getNextOpenSlot(businessHours?: BusinessHours[], now: Date = new Date()): { at: Date, label: string } | null {
  if (!businessHours || businessHours.length === 0) return null;
  const bh = businessHours[0];
  if (!bh.timezone) return null;

  try {
    let checkDate = toDate(now, { timeZone: bh.timezone });
    
    // Look up to 7 days ahead
    for (let i = 0; i < 7; i++) {
      const dayOfWeek = DAYS[checkDate.getDay()];
      const dayConfig = bh.days[dayOfWeek as keyof BusinessHours['days']];
      
      if (dayConfig && dayConfig.enabled && dayConfig.start && dayConfig.end) {
        const [startH, startM] = dayConfig.start.split(':').map(Number);
        const [endH, endM] = dayConfig.end.split(':').map(Number);
        
        const minutesSinceMidnight = checkDate.getHours() * 60 + checkDate.getMinutes();
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (i === 0 && minutesSinceMidnight < endMinutes) {
          if (minutesSinceMidnight < startMinutes) {
            // Later today
            let slot = new Date(now);
            slot.setHours(startH, startM, 0, 0);
            return { at: slot, label: `today at ${dayConfig.start}` };
          }
          // Already open
          if (!bh.force_closed) return null; 
          // If force closed, maybe we still propose next slot? 
          // Actually if it's force closed for today, we should probably look for tomorrow.
        }

        if (i > 0) {
          // Future day
          let slot = addDays(now, i);
          slot.setHours(startH, startM, 0, 0);
          const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'long' });
          return { at: slot, label: `${dayName} at ${dayConfig.start}` };
        }
      }
      checkDate = addDays(checkDate, 1);
      checkDate.setHours(0, 0, 0, 0);
    }
    return null;
  } catch (err) {
    console.error('Error computing next open slot', err);
    return null;
  }
}
