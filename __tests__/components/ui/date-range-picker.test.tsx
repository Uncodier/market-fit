import { fireEvent, render, screen } from "@testing-library/react";
import { differenceInCalendarDays, endOfDay, format, startOfDay, subDays } from "date-fns";
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
        "datePicker.last7Days": "Last 7 days",
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
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 29, 12));
  });
  afterEach(() => jest.useRealTimers());

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

  it.each([93, 366])("disables All time with the explicit %i-day report limit", (maxRangeDays) => {
    const onRangeChange = jest.fn();
    render(<CalendarDateRangePicker maxRangeDays={maxRangeDays} onRangeChange={onRangeChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Select date range" }));
    const allTime = screen.getByRole("button", { name: "All time" });
    expect(allTime).toBeDisabled();
    expect(allTime).toHaveAccessibleDescription(`All time is not available for this report. Select up to ${maxRangeDays} days.`);
    expect(screen.getByText(`All time is not available for this report. Select up to ${maxRangeDays} days.`)).toBeVisible();
    fireEvent.click(allTime);
    expect(onRangeChange).not.toHaveBeenCalled();
  });

  it("does not fabricate an All time start for an unbounded shared picker", () => {
    const onRangeChange = jest.fn();
    render(<CalendarDateRangePicker onRangeChange={onRangeChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Select date range" }));
    expect(screen.getByRole("button", { name: "All time" })).toBeDisabled();
    expect(screen.getByText(/earliest available date is unknown/)).toBeVisible();
    expect(onRangeChange).not.toHaveBeenCalled();
  });

  it.each([
    ["Today", 1], ["Last 7 days", 7], ["Last 30 days", 30], ["Last 90 days", 90],
  ])("selects %s with inclusive days ending today", (preset, days) => {
    const onRangeChange = jest.fn();
    render(<CalendarDateRangePicker maxRangeDays={93} onRangeChange={onRangeChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Select date range" }));
    fireEvent.click(screen.getByRole("button", { name: preset }));
    const today = new Date();
    expect(onRangeChange).toHaveBeenCalledWith(startOfDay(subDays(today, Number(days) - 1)), endOfDay(today));
    expect(onRangeChange).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["This month", new Date(2026, 8, 1), new Date(2026, 8, 29)],
    ["This quarter", new Date(2026, 6, 1), new Date(2026, 8, 29)],
    ["Last month", new Date(2026, 7, 1), new Date(2026, 7, 31)],
  ])("uses the real bounds of %s, not a future month end or quarter's first month", (preset, start, end) => {
    const onRangeChange = jest.fn();
    render(<CalendarDateRangePicker maxRangeDays={93} onRangeChange={onRangeChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Select date range" }));
    fireEvent.click(screen.getByRole("button", { name: String(preset) }));
    expect(onRangeChange).toHaveBeenCalledWith(startOfDay(start as Date), endOfDay(end as Date));
  });

  it("disables presets outside the actual report limit and enables year ranges at 366 days", () => {
    const { rerender } = render(<CalendarDateRangePicker maxRangeDays={93} />);
    fireEvent.click(screen.getByRole("button", { name: "Select date range" }));
    expect(screen.getByRole("button", { name: "Year to date" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Last year" })).toHaveAccessibleDescription("Select up to 93 days.");
    expect(screen.getByRole("button", { name: "This quarter" })).toBeEnabled();
    rerender(<CalendarDateRangePicker maxRangeDays={366} />);
    expect(screen.getByRole("button", { name: "Year to date" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Last year" })).toBeEnabled();
    rerender(<CalendarDateRangePicker maxRangeDays={7} />);
    expect(screen.getByRole("button", { name: "Last 7 days" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Last 30 days" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "This month" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "This quarter" })).toBeDisabled();
  });

  it("keeps historical cross-year ranges exact and permits historical manual selection", () => {
    const onRangeChange = jest.fn();
    render(<CalendarDateRangePicker
      initialStartDate={new Date(1998, 11, 20)} initialEndDate={new Date(1999, 0, 10)}
      maxRangeDays={93} onRangeChange={onRangeChange}
    />);
    const trigger = screen.getByRole("button", { name: "Dec 20, 1998 - Jan 10, 1999" });
    expect(onRangeChange).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: format(new Date(1998, 11, 3), "PPPP") }));
    expect(trigger).toHaveTextContent("Dec 20, 1998 - Jan 10, 1999");
    expect(onRangeChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: format(new Date(1998, 11, 5), "PPPP") }));
    expect(onRangeChange).toHaveBeenCalledWith(startOfDay(new Date(1998, 11, 3)), endOfDay(new Date(1998, 11, 5)));
    expect(trigger).toHaveTextContent("Dec 3 - Dec 5, 1998");
  });

  it.each([93, 94])("validates a %i-day custom range against the 93-day maximum without clamping", (days) => {
    const onRangeChange = jest.fn();
    render(<CalendarDateRangePicker
      initialStartDate={new Date(2026, 0, 10)} initialEndDate={new Date(2026, 0, 12)}
      maxRangeDays={93} onRangeChange={onRangeChange}
    />);
    const trigger = screen.getByRole("button", { name: "Jan 10 - Jan 12, 2026" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: format(new Date(2026, 0, 1), "PPPP") }));
    for (let month = 0; month < 3; month++) fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    const end = new Date(2026, 3, days - 90);
    fireEvent.click(screen.getByRole("button", { name: format(end, "PPPP") }));
    if (days === 93) {
      expect(onRangeChange).toHaveBeenCalledWith(startOfDay(new Date(2026, 0, 1)), endOfDay(end));
      expect(differenceInCalendarDays(onRangeChange.mock.calls[0][1], onRangeChange.mock.calls[0][0]) + 1).toBe(93);
    } else {
      expect(screen.getByRole("alert")).toHaveTextContent("Select up to 93 days.");
      expect(trigger).toHaveTextContent("Jan 10 - Jan 12, 2026");
      expect(onRangeChange).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: format(new Date(2026, 3, 2), "PPPP") }));
      fireEvent.click(screen.getByRole("button", { name: format(new Date(2026, 3, 3), "PPPP") }));
      expect(onRangeChange).toHaveBeenCalledWith(startOfDay(new Date(2026, 3, 2)), endOfDay(new Date(2026, 3, 3)));
    }
  });

  it("rejects a reversed custom range explicitly instead of swapping or substituting dates", () => {
    const onRangeChange = jest.fn();
    render(<CalendarDateRangePicker
      initialStartDate={new Date(2026, 8, 10)} initialEndDate={new Date(2026, 8, 12)} onRangeChange={onRangeChange}
    />);
    const trigger = screen.getByRole("button", { name: "Sep 10 - Sep 12, 2026" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: format(new Date(2026, 8, 20), "PPPP") }));
    fireEvent.click(screen.getByRole("button", { name: format(new Date(2026, 8, 5), "PPPP") }));
    expect(screen.getByRole("alert")).toHaveTextContent("End date must be on or after start date.");
    expect(trigger).toHaveTextContent("Sep 10 - Sep 12, 2026");
    expect(onRangeChange).not.toHaveBeenCalled();
  });

  it.each([
    [new Date(NaN), new Date(2026, 8, 12), "Select valid start and end dates."],
    [new Date(2026, 8, 12), new Date(2026, 8, 1), "End date must be on or after start date."],
    [new Date(2026, 8, 12), undefined, "Select both a start and end date."],
  ])("does not replace invalid initial dates with invented dates", (start, end, message) => {
    const onRangeChange = jest.fn();
    render(<CalendarDateRangePicker initialStartDate={start as Date} initialEndDate={end as Date | undefined} onRangeChange={onRangeChange} />);
    expect(screen.getByRole("button", { name: "Select date range" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(String(message));
    expect(onRangeChange).not.toHaveBeenCalled();
  });

  it("retains a previous valid selection when invalid parent dates arrive, and permits clearing it", () => {
    const onRangeChange = jest.fn();
    const { rerender } = render(<CalendarDateRangePicker
      initialStartDate={new Date(2010, 1, 1)} initialEndDate={new Date(2010, 1, 5)} onRangeChange={onRangeChange}
    />);
    rerender(<CalendarDateRangePicker initialStartDate={new Date(NaN)} initialEndDate={new Date(NaN)} onRangeChange={onRangeChange} />);
    expect(screen.getByRole("button", { name: "Feb 1 - Feb 5, 2010" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Select valid start and end dates.");
    rerender(<CalendarDateRangePicker onRangeChange={onRangeChange} />);
    expect(screen.getByRole("button", { name: "Select date range" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onRangeChange).not.toHaveBeenCalled();
  });

  it("blocks opening while report policy is loading", () => {
    render(<CalendarDateRangePicker disabled />);
    const trigger = screen.getByRole("button", { name: "Select date range" });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("button", { name: "Today" })).not.toBeInTheDocument();
  });

  it("displays an existing over-limit parent range exactly and explains the limit inside the picker", () => {
    const onRangeChange = jest.fn();
    const props = { initialStartDate: new Date(2026, 0, 1), initialEndDate: new Date(2026, 8, 29), onRangeChange };
    const { rerender } = render(<CalendarDateRangePicker {...props} maxRangeDays={93} />);
    const trigger = screen.getByRole("button", { name: "Jan 1 - Sep 29, 2026" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByRole("alert")).toHaveTextContent("Select up to 93 days.");
    rerender(<CalendarDateRangePicker {...props} maxRangeDays={366} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("Jan 1 - Sep 29, 2026");
    expect(onRangeChange).not.toHaveBeenCalled();
  });
});
