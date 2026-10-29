import type { useBooking } from "./use-booking";
import type { RoundRobinCalendar } from "@/app/context/SiteContext";
export type BookingViewState = ReturnType<typeof useBooking> & {
    calendar: RoundRobinCalendar;
};
