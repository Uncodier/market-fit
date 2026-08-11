import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { addDays } from 'date-fns';

export interface BusinessHours {
  name: string
  timezone: string
  respectHolidays?: boolean
  force_closed?: boolean
  /** ISO timestamp: manual open override active until this instant (next scheduled close). */
  force_open_until?: string | null
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

const LOCALE_TAGS: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  ja: 'ja-JP',
};

function formatOpenSlotLabel(date: Date, time: string, isToday: boolean, locale = 'en'): string {
  const lang = locale.split('-')[0];
  const tag = LOCALE_TAGS[lang] || locale || 'en-US';

  if (isToday) {
    switch (lang) {
      case 'es': return `hoy a las ${time}`;
      case 'fr': return `aujourd'hui à ${time}`;
      case 'de': return `heute um ${time}`;
      case 'ja': return `本日 ${time}`;
      default: return `today at ${time}`;
    }
  }

  const dayName = date.toLocaleDateString(tag, { weekday: 'long' });
  switch (lang) {
    case 'es': return `el ${dayName} a las ${time}`;
    case 'fr': return `${dayName} à ${time}`;
    case 'de': return `${dayName} um ${time}`;
    case 'ja': return `${dayName} ${time}`;
    default: return `${dayName} at ${time}`;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isForceOpenActive(bh: BusinessHours, now: Date): boolean {
  if (!bh.force_open_until) return false;
  const until = new Date(bh.force_open_until);
  return !Number.isNaN(until.getTime()) && now < until;
}

/** True when `now` falls inside the configured weekly schedule (ignores manual overrides). */
export function isWithinScheduledHours(
  businessHours?: BusinessHours[],
  now: Date = new Date()
): boolean {
  if (!businessHours || businessHours.length === 0) return true;

  const bh = businessHours[0];
  if (!bh.timezone) return true;

  try {
    const tzDate = toZonedTime(now, bh.timezone);
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
    return true;
  }
}

/**
 * Next scheduled closing instant on/after `now`.
 * If today still has an end time ahead (even before opening), that end is used;
 * otherwise the next enabled day's end.
 */
export function getNextScheduledClose(
  businessHours?: BusinessHours[],
  now: Date = new Date()
): Date | null {
  if (!businessHours || businessHours.length === 0) return null;
  const bh = businessHours[0];
  if (!bh.timezone) return null;

  try {
    let checkDate = toZonedTime(now, bh.timezone);

    for (let i = 0; i < 7; i++) {
      const dayOfWeek = DAYS[checkDate.getDay()];
      const dayConfig = bh.days[dayOfWeek as keyof BusinessHours['days']];

      if (dayConfig?.enabled && dayConfig.end) {
        const [endH, endM] = dayConfig.end.split(':').map(Number);
        const minutesSinceMidnight = checkDate.getHours() * 60 + checkDate.getMinutes();
        const endMinutes = endH * 60 + endM;

        if (i === 0 && minutesSinceMidnight < endMinutes) {
          const dateStr = formatInTimeZone(now, bh.timezone, 'yyyy-MM-dd');
          return fromZonedTime(`${dateStr}T${pad2(endH)}:${pad2(endM)}:00`, bh.timezone);
        }

        if (i > 0) {
          // checkDate is wall-clock in the zone (from toZonedTime / local addDays).
          const y = checkDate.getFullYear();
          const m = pad2(checkDate.getMonth() + 1);
          const d = pad2(checkDate.getDate());
          return fromZonedTime(`${y}-${m}-${d}T${pad2(endH)}:${pad2(endM)}:00`, bh.timezone);
        }
      }

      checkDate = addDays(checkDate, 1);
      checkDate.setHours(0, 0, 0, 0);
    }
    return null;
  } catch (err) {
    console.error('Error computing next scheduled close', err);
    return null;
  }
}

/** Apply manual open/close override on the primary business-hours schedule. */
export function withStoreOpenState(
  businessHours: BusinessHours[],
  wantOpen: boolean,
  now: Date = new Date()
): BusinessHours[] {
  if (!businessHours.length) return businessHours;

  const scheduleOpen = isWithinScheduledHours(businessHours, now);
  const next: BusinessHours = { ...businessHours[0] };

  if (wantOpen) {
    next.force_closed = false;
    if (scheduleOpen) {
      next.force_open_until = null;
    } else {
      const until = getNextScheduledClose(businessHours, now);
      next.force_open_until = until ? until.toISOString() : null;
    }
  } else {
    next.force_open_until = null;
    next.force_closed = scheduleOpen;
  }

  return [next, ...businessHours.slice(1)];
}

export function isBusinessOpen(
  businessHours?: BusinessHours[],
  now: Date = new Date(),
  options?: { ignoreForceClosed?: boolean }
): boolean {
  if (!businessHours || businessHours.length === 0) return true;

  const bh = businessHours[0];
  // Manual overrides — ignore when validating future scheduled slots against the calendar
  if (!options?.ignoreForceClosed) {
    if (bh.force_closed) return false;
    if (isForceOpenActive(bh, now)) return true;
  }

  return isWithinScheduledHours(businessHours, now);
}

export function getNextOpenSlot(
  businessHours?: BusinessHours[],
  now: Date = new Date(),
  locale = 'en'
): { at: Date, label: string } | null {
  if (!businessHours || businessHours.length === 0) return null;
  const bh = businessHours[0];
  if (!bh.timezone) return null;

  if (isForceOpenActive(bh, now) && !bh.force_closed) return null;

  try {
    let checkDate = toZonedTime(now, bh.timezone);
    
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
            return { at: slot, label: formatOpenSlotLabel(slot, dayConfig.start, true, locale) };
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
          return { at: slot, label: formatOpenSlotLabel(checkDate, dayConfig.start, false, locale) };
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
