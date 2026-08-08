import { toZonedTime } from 'date-fns-tz';
import { addDays } from 'date-fns';

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

export function isBusinessOpen(
  businessHours?: BusinessHours[],
  now: Date = new Date(),
  options?: { ignoreForceClosed?: boolean }
): boolean {
  if (!businessHours || businessHours.length === 0) return true;

  const bh = businessHours[0];
  // force_closed is a temporary "closed now" override — ignore it when validating future scheduled slots
  if (bh.force_closed && !options?.ignoreForceClosed) return false;
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
    return true; // fallback to open
  }
}

export function getNextOpenSlot(
  businessHours?: BusinessHours[],
  now: Date = new Date(),
  locale = 'en'
): { at: Date, label: string } | null {
  if (!businessHours || businessHours.length === 0) return null;
  const bh = businessHours[0];
  if (!bh.timezone) return null;

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
