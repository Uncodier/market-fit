import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { readFileSync } from "fs"
import path from "path"
import postcss, { type AnyNode } from "postcss"
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
      let parent: AnyNode | undefined = rule.parent
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

  it("keeps mobile CTAs and their header wrappers at the Safari-sized 48px minimum", () => {
    const css = postcss.parse(readFileSync(path.join(process.cwd(), "app/styles/mobile-primary-buttons.css"), "utf8"))
    const declarations = (selector: string) => {
      const values: Record<string, string> = {}
      css.walkRules((rule) => {
        if (!rule.selectors.includes(selector)) return
        rule.walkDecls((declaration) => {
          values[declaration.prop] = `${declaration.value}${declaration.important ? " !important" : ""}`
        })
      })
      return values
    }
    expect(declarations(".btn-primary")["min-height"]).toBe("48px !important")
    expect(declarations(".btn-primary-well")["min-height"]).toBe("48px !important")
    expect(declarations(".btn-primary.btn-primary-circular")["min-width"]).toBe("48px !important")
    expect(declarations("[data-toolbar-font] .btn-primary")).toMatchObject({
      "min-height": "48px !important",
      "min-width": "48px !important",
    })
    expect(declarations("[data-toolbar-font] .btn-primary-well")["min-height"]).toBe("48px !important")
  })

  it("replaces opaque desktop paint with tinted glass and removes Safari's hard-edged blobs", () => {
    const css = postcss.parse(readFileSync(path.join(process.cwd(), "app/styles/mobile-primary-buttons.css"), "utf8"))
    const glass = css.nodes.flatMap((node) => node.type === "atrule" ? node.nodes ?? [] : [])
      .find((node) => node.type === "rule" && node.selector === 'html .btn-primary:not(:disabled):not([aria-disabled="true"])')
    expect(glass?.type).toBe("rule")
    const values: Record<string, string> = {}
    if (glass?.type === "rule") glass.walkDecls((decl) => { values[decl.prop] = decl.value })
    expect(values["background-color"]).toBe("rgb(var(--btn-fill) / 0.94)")
    expect(values["-webkit-backdrop-filter"]).toBe("blur(14px) saturate(150%)")
    expect(values["background-image"]).toContain("radial-gradient")
    const hidden: string[] = []
    css.walkRules((rule) => {
      rule.walkDecls("display", (decl) => {
        if (decl.value === "none" && decl.important) hidden.push(...rule.selectors)
      })
    })
    expect(hidden).toEqual(expect.arrayContaining([".btn-primary::before", ".btn-primary::after"]))
  })

  it("sizes shared and standalone mobile primary icons to 24px without enlarging the button", () => {
    const css = postcss.parse(readFileSync(path.join(process.cwd(), "app/styles/mobile-primary-buttons.css"), "utf8"))
    const selectors = [
      "html .btn-primary > .safari-icon-fix",
      "html .btn-primary > .safari-icon-fix > svg",
      "html .btn-primary > svg",
    ]
    for (const selector of selectors) {
      const values: Record<string, string> = {}
      css.walkRules((rule) => {
        if (!rule.selectors.includes(selector)) return
        rule.walkDecls((decl) => {
          values[decl.prop] = `${decl.value}${decl.important ? " !important" : ""}`
        })
      })
      expect(values).toMatchObject({
        width: "24px !important",
        height: "24px !important",
        "min-width": "24px !important",
        "min-height": "24px !important",
        "flex-shrink": "0",
      })
    }
  })
})