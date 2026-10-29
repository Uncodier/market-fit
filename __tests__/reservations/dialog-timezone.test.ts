import { zonedTaskInstant, taskTimeZone } from "@/lib/calendar/timezone"
import { hydrateReservationForm } from "@/app/reservations/components/reservation-dialog-hydrate"
import { submitTeamTaskReservation } from "@/app/reservations/components/reservation-dialog-submit"
import { createTask, updateTask } from "@/app/leads/tasks/actions"
import type { Reservation } from "@/app/types"

jest.mock("@/app/leads/tasks/actions", () => ({ createTask: jest.fn(), updateTask: jest.fn() }))
jest.mock("@/app/commerce/resolve-relation", () => ({ resolveRelationId: jest.fn() }))
jest.mock("@/app/reservations/actions", () => ({}))
jest.mock("@/app/reservations/sale-order-actions", () => ({}))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const reservation = {
  is_task: true, original_task_id: "task-one", start_time: "2026-10-29T15:00:00.000Z",
  original_task_metadata: { timezone: "America/Mexico_City", custom: "preserve" },
} as Reservation

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createTask).mockResolvedValue({})
  jest.mocked(updateTask).mockResolvedValue({})
})

it.each([
  ["America/Mexico_City", "2026-10-29T15:00:00.000Z"],
  ["Asia/Tokyo", "2026-10-29T00:00:00.000Z"],
  ["Asia/Kolkata", "2026-10-29T03:30:00.000Z"],
])("converts calendar days in %s without relying on browser offset", (zone, expected) => {
  expect(zonedTaskInstant(new Date(2026, 9, 29), "09:00", zone)).toBe(expected)
})

it("applies the event date's daylight saving offset", () => {
  expect(zonedTaskInstant(new Date(2026, 6, 1), "09:00", "Europe/Madrid")).toBe("2026-07-01T07:00:00.000Z")
  expect(zonedTaskInstant(new Date(2026, 0, 1), "09:00", "Europe/Madrid")).toBe("2026-01-01T08:00:00.000Z")
})

it("rejects missing and repeated DST times, but preserves an unchanged existing instant", () => {
  expect(() => zonedTaskInstant(new Date(2026, 2, 8), "02:30", "America/New_York")).toThrow("does not exist")
  expect(() => zonedTaskInstant(new Date(2026, 10, 1), "01:30", "America/New_York")).toThrow("occurs twice")
  expect(zonedTaskInstant(new Date(2026, 10, 1), "01:30", "America/New_York", "2026-11-01T06:30:00Z")).toBe("2026-11-01T06:30:00Z")
})

it("restores the saved zone and its wall-clock date/time", () => {
  const form = hydrateReservationForm(reservation)
  expect(form.timezone).toBe("America/Mexico_City")
  expect(form.taskTime).toBe("09:00")
  expect(form.taskDate).toEqual(new Date(2026, 9, 29))
  expect(taskTimeZone({ _calendar_context: { timezone: "Asia/Tokyo" } })).toBe("Asia/Tokyo")
})

it.each([false, true])("persists the chosen zone on task save (edit=%s)", async isEdit => {
  await submitTeamTaskReservation({
    siteId: "site-one", isEdit, reservation: isEdit ? reservation : null,
    taskTitle: "Meeting", taskDate: new Date(2026, 9, 29), taskTime: "09:00",
    timezone: "America/Mexico_City", taskType: "meeting", taskAssignee: "user-one",
    leadValue: null, notes: "", taskCalendarSchedule: { id: "calendar-one", duration_minutes: 30 },
    t: () => "",
  })
  const payload = isEdit ? jest.mocked(updateTask).mock.calls[0][1] : jest.mocked(createTask).mock.calls[0][0]
  expect(payload.scheduled_date).toBe("2026-10-29T15:00:00.000Z")
  expect(payload.metadata).toMatchObject({
    timezone: "America/Mexico_City",
    _calendar_context: { timezone: "America/Mexico_City", end_time: "2026-10-29T15:30:00.000Z" },
  })
  if (isEdit) expect(payload.metadata.custom).toBe("preserve")
})