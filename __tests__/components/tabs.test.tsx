import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"

describe("shared tab selector", () => {
  it("uses a distinct dark surface while preserving the light background", () => {
    render(
      <Tabs defaultValue="numpad">
        <TabsList>
          <TabsTrigger value="options">Options</TabsTrigger>
          <TabsTrigger value="numpad">Numpad</TabsTrigger>
        </TabsList>
      </Tabs>
    )

    expect(screen.getByRole("tablist")).toHaveClass("bg-muted", "dark:bg-secondary")
    expect(screen.getByRole("tab", { name: "Numpad" }))
      .toHaveClass("data-[state=active]:bg-background", "data-[state=active]:text-foreground")
  })

  it("preserves layout classes, refs and explicit dark background overrides", () => {
    const ref = React.createRef<HTMLDivElement>()
    render(
      <Tabs defaultValue="options">
        <TabsList ref={ref} className="grid w-full grid-cols-2 dark:bg-transparent">
          <TabsTrigger value="options">Options</TabsTrigger>
        </TabsList>
      </Tabs>
    )

    const list = screen.getByRole("tablist")
    expect(ref.current).toBe(list)
    expect(list).toHaveClass("grid", "w-full", "grid-cols-2", "bg-muted", "dark:bg-transparent")
    expect(list).not.toHaveClass("dark:bg-secondary")
  })

  it("still switches between the POS-style options and numpad tabs", () => {
    render(
      <Tabs defaultValue="numpad">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="options">Options</TabsTrigger>
          <TabsTrigger value="numpad">Numpad</TabsTrigger>
        </TabsList>
        <TabsContent value="options">Order options</TabsContent>
        <TabsContent value="numpad">Numeric keypad</TabsContent>
      </Tabs>
    )

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Numeric keypad")
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Options" }), { button: 0 })
    expect(screen.getByRole("tab", { name: "Options" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Order options")

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Numpad" }), { button: 0 })
    expect(screen.getByRole("tab", { name: "Numpad" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Numeric keypad")
  })
})