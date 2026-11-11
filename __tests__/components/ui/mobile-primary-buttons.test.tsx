import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { readFileSync } from "fs"
import path from "path"
import postcss from "postcss"
import { Button } from "@/app/components/ui/button"

jest.mock("@/app/components/ui/use-btn-glass-motion", () => ({
  useBtnGlassMotion: () => jest.fn(),
}))
jest.mock("@/app/context/PermissionContext", () => ({
  useOptionalPermissions: () => null,
}))

describe("mobile primary buttons", () => {
  it.each([
    ["default", undefined],
    ["destructive", "btn-tint-red"],
    ["whatsapp", "btn-tint-whatsapp"],
  ] as const)("preserves the %s tint, icon and action", (tint, tintClass) => {
    const onClick = jest.fn()
    render(
      <Button tint={tint} onClick={onClick}>
        <svg data-testid="action-icon" aria-hidden="true" />
        Continue
      </Button>
    )
    const button = screen.getByRole("button", { name: "Continue" })
    expect(button).toContainElement(screen.getByTestId("action-icon"))
    expect(button.parentElement).toHaveClass("btn-primary-well")
    if (tintClass) expect(button.parentElement).toHaveClass(tintClass)
    expect(button.querySelector(".btn-glass-surface .btn-glass-rim")).not.toBeNull()
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("preserves custom tint channels and circular sizing", () => {
    render(
      <Button size="icon" aria-label="Continue" style={{ "--btn-tint": "20, 140, 200" } as React.CSSProperties}>
        <svg aria-hidden="true" />
      </Button>
    )
    const button = screen.getByRole("button", { name: "Continue" })
    expect(button).toHaveClass("btn-primary-circular")
    expect(button.style.getPropertyValue("--btn-tint")).toBe("20 140 200")
  })

  it("retains link semantics and the same glass surface with asChild", () => {
    render(<Button asChild><a href="/projects">Projects</a></Button>)
    const link = screen.getByRole("link", { name: "Projects" })
    expect(link).toHaveAttribute("href", "/projects")
    expect(link.querySelector(".btn-glass-surface")).not.toBeNull()
  })

  it("does not add glass decoration to secondary buttons", () => {
    render(<Button variant="secondary">Continue</Button>)
    expect(screen.getByRole("button").querySelector(".btn-glass-surface")).toBeNull()
  })

  it("keeps disabled buttons non-interactive", () => {
    const onClick = jest.fn()
    render(<Button disabled onClick={onClick}>Continue</Button>)
    fireEvent.click(screen.getByRole("button"))
    expect(onClick).not.toHaveBeenCalled()
  })

  it("scopes all overrides to mobile and never adds inset shadows or replaces tints", () => {
    const css = postcss.parse(readFileSync(path.join(process.cwd(), "app/styles/mobile-primary-buttons.css"), "utf8"))
    css.walkRules((rule) => {
      let parent = rule.parent
      while (parent && !(parent.type === "atrule" && parent.name === "media" && parent.params === "(max-width: 767px)")) {
        parent = parent.parent
      }
      expect(parent).toBeDefined()
    })
    css.walkDecls((declaration) => {
      expect(["--btn-tint", "--btn-fill", "color"]).not.toContain(declaration.prop)
      if (declaration.prop === "box-shadow") expect(declaration.value).not.toContain("inset")
    })
  })
})