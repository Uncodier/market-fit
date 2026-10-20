import { createRef, useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { CommerceSearchInput } from "@/app/components/commerce/CommerceSearchInput"

function ControlledSearch() {
  const [value, setValue] = useState("")
  return <CommerceSearchInput placeholder="Search products" value={value} onChange={setValue} />
}

describe("CommerceSearchInput", () => {
  it("shows a right-side clear button only while there is text and supports searching again", () => {
    render(<ControlledSearch />)
    const input = screen.getByRole("textbox", { name: "Search products" })
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: "coffee" } })
    const clear = screen.getByRole("button", { name: "Clear search" })
    expect(clear).toHaveClass("absolute", "right-1")
    expect(input).toHaveClass("pr-10")

    clear.focus()
    fireEvent.click(clear)
    expect(input).toHaveValue("")
    expect(input).toHaveFocus()
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: "tea" } })
    expect(input).toHaveValue("tea")
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument()
  })

  it("can clear whitespace without submitting an enclosing form", () => {
    const onSubmit = jest.fn((event) => event.preventDefault())
    const onChange = jest.fn()
    render(<form onSubmit={onSubmit}>
      <CommerceSearchInput placeholder="Search" value="   " onChange={onChange} />
    </form>)

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(onChange).toHaveBeenCalledWith("")
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("forwards the input ref and preserves focus on pointer activation", () => {
    const ref = createRef<HTMLInputElement>()
    render(<CommerceSearchInput ref={ref} placeholder="Search" value="coffee" onChange={jest.fn()} />)
    expect(ref.current).toBe(screen.getByRole("textbox"))
    ref.current?.focus()
    const clear = screen.getByRole("button", { name: "Clear search" })
    expect(fireEvent.mouseDown(clear)).toBe(false)
    expect(ref.current).toHaveFocus()
  })

  it.each(["disabled", "readOnly"] as const)("does not clear a %s input", (attribute) => {
    const onChange = jest.fn()
    render(<CommerceSearchInput placeholder="Search" value="coffee" onChange={onChange} {...{ [attribute]: true }} />)
    const clear = screen.getByRole("button", { name: "Clear search" })
    expect(clear).toBeDisabled()
    fireEvent.click(clear)
    expect(onChange).not.toHaveBeenCalled()
  })
})