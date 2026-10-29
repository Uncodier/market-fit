import type { useBooking } from "./use-booking";
import type { ProfileData, EventType } from "@/app/services/profile.service";
export type BookingViewState = ReturnType<typeof useBooking> & {
    profile: ProfileData;
    eventType: EventType;
};
