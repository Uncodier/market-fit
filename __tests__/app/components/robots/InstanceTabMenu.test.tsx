import { fireEvent, render, screen } from "@testing-library/react"
import { InstanceTabMenu } from "@/app/components/robots/InstanceTabMenu"

function renderMenu(overrides: Partial<React.ComponentProps<typeof InstanceTabMenu>> = {}) {
  const handlers = {
    onOpen: jest.fn(),
    onRename: jest.fn(),
    onArchive: jest.fn(),
    onDelete: jest.fn(),
  }

  render(
    <InstanceTabMenu
      instanceName="Research agent"
      isDeleting={false}
      {...handlers}
      {...overrides}
    />,
  )

  fireEvent.keyDown(
    screen.getByRole("button", { name: "Actions for Research agent" }),
    { key: "Enter", code: "Enter" },
  )
  return handlers
}

describe("InstanceTabMenu", () => {
  it.each([
    ["Open", "onOpen"],
    ["Rename", "onRename"],
    ["Archive", "onArchive"],
    ["Delete", "onDelete"],
  ] as const)("runs the %s action", (label, handlerName) => {
    const handlers = renderMenu()

    fireEvent.click(screen.getByRole("menuitem", { name: label }))

    expect(handlers[handlerName]).toHaveBeenCalledTimes(1)
  })

  it("disables rename for requirement-backed instances", () => {
    const handlers = renderMenu({ canRename: false })

    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }))

    expect(handlers.onRename).not.toHaveBeenCalled()
  })

  it("does not propagate the trigger or menu actions to the tab", () => {
    const onTabOpen = jest.fn()
    const onDelete = jest.fn()

    render(
      <div onClick={onTabOpen}>
        <InstanceTabMenu
          instanceName="Research agent"
          isDeleting={false}
          onOpen={jest.fn()}
          onRename={jest.fn()}
          onArchive={jest.fn()}
          onDelete={onDelete}
        />
      </div>,
    )

    const trigger = screen.getByRole("button", { name: "Actions for Research agent" })
    fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" })
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onTabOpen).not.toHaveBeenCalled()
  })
})
