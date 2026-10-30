import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CourseExperienceClient } from "@/app/buyer/course/[entitlementId]/CourseExperienceClient"
import { saveCourseProgress } from "@/app/commerce/course-progress"
import { CourseLessonPlayer } from "@/app/components/commerce/pdp/CourseLessonPlayer"
import type { ComponentProps } from "react"
import type { CourseProgress } from "@/app/buyer/course/[entitlementId]/course-progress-state"

jest.mock("@/app/commerce/course-progress", () => ({ saveCourseProgress: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => ({
    "pdp.course.markComplete": "Mark complete", "pdp.course.completed": "Completed",
  }[key] || key) }),
}))
jest.mock("@/app/components/commerce/pdp/BuyerExperienceShell", () => ({
  BuyerExperienceShell: ({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) => <div>{actions}{children}</div>,
}))
jest.mock("@/app/components/commerce/pdp/CoursePdpLayout", () => ({
  CoursePdpLayout: ({ item, experience }: {
    item: { name: string; metadata: { videos: ({ url: string; title: string } | null)[] } }
    experience: { extras: { progress: CourseProgress; onProgressUpdate: (index: number, completed: boolean) => void } }
  }) => <CourseLessonPlayer title={item.name}
    videos={item.metadata.videos.filter((video): video is { url: string; title: string } => !!video?.url)}
    progress={experience.extras.progress} onProgressUpdate={experience.extras.onProgressUpdate} />,
}))

const item = { id: "course-a", name: "Course A", metadata: { videos: [
  null, { url: "https://example.com/lesson-a.mp4", title: "First lesson" }, { url: "" }, { url: "https://example.com/lesson-b.mp4", title: "Second lesson" },
] } } as unknown as ComponentProps<typeof CourseExperienceClient>["item"]
const entitlement = { id: "entitlement-a", metadata: { course_progress: { lastIndex: 99, completedIndexes: [0, 0, 2, -1, "1"] } } }
const save = jest.mocked(saveCourseProgress)
beforeEach(() => { save.mockReset(); save.mockResolvedValue({ success: true }) })
beforeEach(() => { jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {}) })
afterEach(() => { jest.restoreAllMocks() })

it("uses sanitized filtered indexes and supports live uncompletion and navigation", async () => {
  render(<CourseExperienceClient item={item} entitlement={entitlement} backUrl="/buyer/library" />)
  expect(screen.getByRole("heading", { name: "First lesson" })).toBeInTheDocument()
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Completed" }))
  expect(screen.getByRole("button", { name: "Mark complete" })).toBeInTheDocument()
  await waitFor(() => expect(save).toHaveBeenCalledWith("entitlement-a", { lastIndex: 0, completedIndexes: [] }))
  fireEvent.click(screen.getByRole("button", { name: /2. Second lesson/ }))
  await waitFor(() => expect(save).toHaveBeenLastCalledWith("entitlement-a", { lastIndex: 1, completedIndexes: [] }))
})

it("announces saving, shows a safe error with fallbacks and retries latest changes", async () => {
  let finish!: (result: { error: string }) => void
  save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(<CourseExperienceClient item={item} entitlement={entitlement} backUrl="/buyer/library" />)
  fireEvent.click(screen.getByRole("button", { name: "Completed" }))
  expect(screen.getByRole("status")).toHaveTextContent("Saving...")
  fireEvent.click(screen.getByRole("button", { name: /2. Second lesson/ }))
  fireEvent.click(screen.getByRole("button", { name: "Mark complete" }))
  expect(save).toHaveBeenCalledTimes(1)
  await act(async () => { finish({ error: "secret database detail" }) })
  expect(screen.getByRole("alert")).toHaveTextContent("Progress could not be saved")
  expect(screen.queryByText(/secret database/)).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Completed" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
  expect(save).toHaveBeenLastCalledWith("entitlement-a", { lastIndex: 1, completedIndexes: [1] })
})

it("scopes demo progress to its mounted course and resets on entitlement or mode changes", async () => {
  const { rerender } = render(<CourseExperienceClient item={item} entitlement={entitlement} backUrl="/home/library" demo />)
  fireEvent.click(screen.getByRole("button", { name: "Completed" }))
  fireEvent.click(screen.getByRole("button", { name: /2. Second lesson/ }))
  fireEvent.click(screen.getByRole("button", { name: "Mark complete" }))
  expect(save).not.toHaveBeenCalled()
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
  rerender(<CourseExperienceClient item={item} entitlement={{ id: "entitlement-b" }} backUrl="/home/library" demo />)
  expect(screen.getByRole("heading", { name: "First lesson" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Mark complete" })).toBeInTheDocument()
  rerender(<CourseExperienceClient item={item} entitlement={{ id: "entitlement-b" }} backUrl="/buyer/library" />)
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Mark complete" }))
  await waitFor(() => expect(save).toHaveBeenCalledWith("entitlement-b", { lastIndex: 0, completedIndexes: [0] }))
})