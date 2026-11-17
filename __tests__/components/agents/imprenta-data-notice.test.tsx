import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ImprentaDataNotice } from "@/app/components/agents/imprenta-panel/data-notice"
import { toast } from "sonner"

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }))

it("does not add a blocking loading overlay for background data", () => {
  const view = render(<ImprentaDataNotice graphError={undefined} logsError={undefined} onRetry={jest.fn()} />)
  expect(view.container).toBeEmptyDOMElement()
})

it("shows a safe error and retries without leaking backend details", async () => {
  const onRetry = jest.fn().mockRejectedValue(new Error("private backend detail"))
  render(<ImprentaDataNotice graphError={new Error("private backend detail")} logsError={undefined} onRetry={onRetry} />)
  expect(screen.getByRole("alert")).toHaveTextContent("Canvas data is unavailable")
  expect(screen.queryByText(/private backend detail/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not reload canvas data. Please try again."))
  expect(onRetry).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled()
})

it("distinguishes unavailable details from a failed graph", () => {
  render(<ImprentaDataNotice graphError={undefined} logsError={new Error("logs")} onRetry={jest.fn()} />)
  expect(screen.getByRole("alert")).toHaveTextContent("Some result details could not load")
})