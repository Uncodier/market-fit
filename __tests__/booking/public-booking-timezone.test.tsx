import { act, renderHook, waitFor } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { useBooking as useUserBooking } from "@/app/book/[siteSlug]/[userSlug]/[eventSlug]/use-booking";
import { useBooking as useRRBooking } from "@/app/book/[siteSlug]/rr/[eventSlug]/use-booking";
import { getAvailableSlots, getRRAvailability } from "@/app/book/availability";

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  use: (resource: { value: unknown }) => resource.value,
}));
jest.mock("@/app/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", setTheme: jest.fn() }),
}));
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ locale: "en", setLocale: jest.fn(), t: (key: string) => key }),
}));
jest.mock("@/app/book/actions", () => ({
  getProfileBySlug: jest.fn(async () => ({
    id: "host", settings: { calendar: { event_types: [{ slug: "meeting", duration: 30, buffer: 0 }] } },
  })),
  getSiteInfoBySlug: jest.fn(async () => ({ id: "site", name: "Site" })),
  getRRCalendarBySlug: jest.fn(async () => ({ calendar: { id: "calendar", member_ids: ["host"], duration: 30, buffer: 0 } })),
  bookMeeting: jest.fn(),
  bookRRMeeting: jest.fn(),
}));
jest.mock("@/app/book/availability", () => ({
  getAvailableSlots: jest.fn(async () => ["10:00"]),
  getRRAvailability: jest.fn(async () => ["10:00"]),
  getMonthAvailability: jest.fn(async () => ({})),
  getRRMonthAvailability: jest.fn(async () => ({})),
}));

const params = Object.assign(Promise.resolve({ siteSlug: "site", userSlug: "host", eventSlug: "meeting" }), {
  value: { siteSlug: "site", userSlug: "host", eventSlug: "meeting" },
});
const props = { params, searchParams: Promise.resolve({}) };

for (const [label, useBooking] of [["personal", useUserBooking], ["round robin", useRRBooking]] as const) {
  describe(`${label} booking timezone`, () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("tz=Europe/London") as ReturnType<typeof useSearchParams>);
    });

    it.each(["tz", "timezone", "region"])("accepts a valid %s URL timezone", async (key) => {
      jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(`${key}=Asia/Tokyo`) as ReturnType<typeof useSearchParams>);
      const { result } = renderHook(() => useBooking(props));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.userTimezone).toBe("Asia/Tokyo");
    });

    it("falls back to the browser timezone for an invalid URL value", async () => {
      jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("tz=Not/A_Zone") as ReturnType<typeof useSearchParams>);
      const { result } = renderHook(() => useBooking(props));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.userTimezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    });

    it("clears the selected slot even when the new zone has the same wall time", async () => {
      const { result } = renderHook(() => useBooking(props));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.setSelectedDate(new Date(2030, 0, 15)));
      await waitFor(() => expect(result.current.availableSlots).toEqual(["10:00"]));
      act(() => {
        result.current.setSelectedSlot("10:00");
        result.current.setActiveStep("details");
      });
      act(() => result.current.handleTimezoneChange("Asia/Tokyo"));
      expect(result.current.selectedSlot).toBeNull();
      expect(result.current.activeStep).toBe("time");
      await waitFor(() => expect(result.current.isLoadingSlots).toBe(false));
      expect(result.current.selectedSlot).toBeNull();
      const loadSlots = label === "personal" ? getAvailableSlots : getRRAvailability;
      expect(loadSlots).toHaveBeenLastCalledWith(expect.anything(), "2030-01-15", 30, 0, "Asia/Tokyo");
    });

    it("ignores availability responses from the previous timezone", async () => {
      const loadSlots = label === "personal" ? getAvailableSlots : getRRAvailability;
      let resolveOldSlots!: (slots: string[]) => void;
      jest.mocked(loadSlots).mockImplementationOnce(() => new Promise((resolve) => {
        resolveOldSlots = resolve;
      }));
      const { result } = renderHook(() => useBooking(props));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.setSelectedDate(new Date(2030, 0, 15)));
      await waitFor(() => expect(loadSlots).toHaveBeenCalledTimes(1));
      await act(async () => result.current.handleTimezoneChange("Asia/Tokyo"));
      expect(result.current.availableSlots).toEqual(["10:00"]);
      await act(async () => resolveOldSlots(["09:00"]));
      expect(result.current.availableSlots).toEqual(["10:00"]);
      expect(result.current.selectedSlot).toBeNull();
    });

    it("keeps the calendar active without a date and ignores invalid manual values", async () => {
      const { result } = renderHook(() => useBooking(props));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => result.current.handleTimezoneChange("Asia/Tokyo"));
      expect(result.current.activeStep).toBe("calendar");
      act(() => result.current.handleTimezoneChange("invalid"));
      expect(result.current.userTimezone).toBe("Asia/Tokyo");
    });
  });
}
