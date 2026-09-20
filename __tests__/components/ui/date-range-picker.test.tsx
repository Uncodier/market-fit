import { fireEvent, render, screen } from "@testing-library/react";
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker";

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    locale: "en",
    t: (key: string) => {
      const translations: Record<string, string> = {
        "datePicker.today": "Today",
        "datePicker.thisWeek": "This week",
        "datePicker.thisMonth": "This month",
        "datePicker.lastMonth": "Last month",
        "datePicker.last30Days": "Last 30 days",
        "datePicker.thisQuarter": "This quarter",
        "datePicker.yearToDate": "Year to date",
        "datePicker.lastYear": "Last year",
        "datePicker.allTime": "All time",
        "datePicker.presetRanges": "Preset ranges",
        "datePicker.selectDate": "Select date",
        "datePicker.selectDateRange": "Select date range",
        "datePicker.to": "to",
        "datePicker.previousMonth": "Previous month",
        "datePicker.nextMonth": "Next month",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/app/hooks/use-mobile-view", () => ({
  useIsMobile: () => false,
}));

describe("CalendarDateRangePicker", () => {
  it("reports a selected preset to its parent", () => {
    const onRangeChange = jest.fn();
    render(
      <CalendarDateRangePicker
        initialStartDate={new Date("2026-08-20T00:00:00")}
        initialEndDate={new Date("2026-09-19T23:59:59")}
        onRangeChange={onRangeChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Aug 20/i }));
    fireEvent.click(screen.getByText("Today"));

    expect(onRangeChange).toHaveBeenCalledTimes(1);
  });

  it("does not block user selection after syncing a cached range", () => {
    const onRangeChange = jest.fn();
    const { rerender } = render(
      <CalendarDateRangePicker
        initialStartDate={new Date("2026-08-01T00:00:00")}
        initialEndDate={new Date("2026-08-31T23:59:59")}
        onRangeChange={onRangeChange}
      />,
    );

    rerender(
      <CalendarDateRangePicker
        initialStartDate={new Date("2026-09-01T00:00:00")}
        initialEndDate={new Date("2026-09-10T23:59:59")}
        onRangeChange={onRangeChange}
      />,
    );

    expect(onRangeChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Sep 1/i }));
    fireEvent.click(screen.getByText("Today"));
    expect(onRangeChange).toHaveBeenCalledTimes(1);
  });
});
