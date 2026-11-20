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
      expect(["--btn-tint", "--btn-fill"]).not.toContain(declaration.prop)
      if (declaration.prop === "color") {
        expect(declaration.parent?.type).toBe("rule")
        expect((declaration.parent as postcss.Rule).selector).toContain(".btn-primary")
        expect(declaration.value).toBe("hsl(var(--foreground))")
      }
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
    expect(declarations(".btn-primary")).toMatchObject({
      "min-height": "48px !important",
      "min-width": "48px !important",
    })
    expect(declarations(".btn-primary-well")["min-height"]).toBe("48px !important")
  })

  it("keeps topbar icon actions square and visually hides only their labels on mobile", () => {
    const css = postcss.parse(readFileSync(path.join(process.cwd(), "app/styles/mobile-primary-buttons.css"), "utf8"))
    const valuesFor = (selector: string) => {
      const values: Record<string, string> = {}
      css.walkRules((rule) => {
        if (!rule.selectors.includes(selector)) return
        rule.walkDecls((decl) => {
          values[decl.prop] = `${decl.value}${decl.important ? " !important" : ""}`
        })
      })
      return values
    }
    const scope = ":is([data-topbar], [data-page-primary-actions])"
    const iconButton = `${scope} .btn-primary:has(> :is(.safari-icon-fix, svg))`
    const well = `${scope} .btn-primary-well:has(> .btn-primary > :is(.safari-icon-fix, svg))`
    for (const selector of [iconButton, well]) {
      expect(valuesFor(selector)).toMatchObject({
        width: "48px !important",
        "min-width": "48px !important",
        "max-width": "48px !important",
        padding: "0 !important",
        gap: "0 !important",
      })
    }
    expect(valuesFor(`${iconButton} > span:not(.safari-icon-fix):not(.btn-glass-surface)`)).toMatchObject({
      display: "block !important",
      position: "absolute !important",
      width: "1px !important",
      height: "1px !important",
      overflow: "hidden !important",
      clip: "rect(0, 0, 0, 0) !important",
    })
    const onClick = jest.fn()
    render(<div><Button onClick={onClick}>
      <svg aria-hidden="true" data-testid="topbar-icon" />
      <span className="hidden sm:inline ml-2">Create</span>
    </Button></div>)
    const button = screen.getByRole("button", { name: "Create" })
    expect(button).toContainElement(screen.getByTestId("topbar-icon"))
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("removes mobile glass paint and decoration only from topbar primary buttons", () => {
    const css = postcss.parse(readFileSync(path.join(process.cwd(), "app/styles/mobile-primary-buttons.css"), "utf8"))
    const scope = ":is([data-topbar], [data-page-primary-actions])"
    const paint = css.nodes.flatMap((node) => node.type === "atrule" ? node.nodes ?? [] : [])
      .find((node) => node.type === "rule" && node.selectors.includes(`html ${scope} .btn-primary.btn-primary`))
    expect(paint?.type).toBe("rule")
    const values: Record<string, string> = {}
    if (paint?.type === "rule") paint.walkDecls((decl) => {
      expect(decl.important).toBe(true)
      values[decl.prop] = decl.value
    })
    expect(values).toMatchObject({
      "background-color": "transparent",
      "background-image": "none",
      border: "0",
      "box-shadow": "none",
      "backdrop-filter": "none",
      "-webkit-backdrop-filter": "none",
      "text-shadow": "none",
      color: "hsl(var(--foreground))",
    })
    const surface = css.nodes.flatMap((node) => node.type === "atrule" ? node.nodes ?? [] : [])
      .find((node) => node.type === "rule" && node.selector === `${scope} .btn-primary > .btn-glass-surface`)
    const hidden: string[] = []
    if (surface?.type === "rule") surface.walkDecls("display", (decl) => {
      hidden.push(decl.value)
    })
    expect(hidden).toEqual(["none"])
    expect(paint?.type === "rule" && paint.selectors).toEqual([
      `html ${scope} .btn-primary.btn-primary`,
      `html ${scope} .btn-primary-well`,
    ])
  })

  it("keeps tinted mobile glass and hides the inner lights only in the topbar or when disabled", () => {
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
    const scope = ":is([data-topbar], [data-page-primary-actions])"
    const lights = hidden.filter(selector => /\.btn-primary::(before|after)$/.test(selector))
    expect(lights).toEqual([`${scope} .btn-primary::before`, `${scope} .btn-primary::after`])
  })

  it("sizes mobile topbar primary icons to 28px without changing the button size", () => {
    const css = postcss.parse(readFileSync(path.join(process.cwd(), "app/styles/mobile-primary-buttons.css"), "utf8"))
    const button = "html :is([data-topbar], [data-page-primary-actions]) .btn-primary.btn-primary.btn-primary"
    const selectors = ["> .safari-icon-fix", "> .safari-icon-fix > svg", "> svg"].map(selector => `${button} ${selector}`)
    for (const selector of selectors) {
      const values: Record<string, string> = {}
      css.walkRules((rule) => {
        if (!rule.selectors.includes(selector)) return
        rule.walkDecls((decl) => {
          values[decl.prop] = `${decl.value}${decl.important ? " !important" : ""}`
        })
      })
      expect(values).toMatchObject({
        width: "28px !important",
        height: "28px !important",
        "min-width": "28px !important",
        "min-height": "28px !important",
        "max-width": "28px !important",
        "max-height": "28px !important",
        margin: "0 !important",
        "flex-shrink": "0 !important",
      })
    }
    const strokes: string[] = []
    css.walkDecls("stroke-width", declaration => { strokes.push(declaration.value) })
    expect(strokes).toEqual(["1.5"])
  })
})