import { fireEvent, render, screen } from "@testing-library/react"
import { MobileInstanceBackButton } from "@/app/robots/mobile-instance-back-button"

test("opens the instance selector through its callback and is mobile-only", () => {
  const onBack = jest.fn()
  render(<MobileInstanceBackButton onBack={onBack} />)
  const button = screen.getByRole("button", { name: "Back to instances" })
  expect(button).toHaveClass("md:!hidden")
  expect(button.querySelector("svg")).toBeInTheDocument()
  fireEvent.click(button)
  expect(onBack).toHaveBeenCalledTimes(1)
})