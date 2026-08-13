import {
  dialogSizeClassName,
  isDismissEventFromFloatingLayer,
  overlayClassName,
  preventDismissFromFloatingLayer,
} from "@/app/components/ui/overlay-styles"

describe("overlay styles", () => {
  it("uses a light dim overlay with a thin blur", () => {
    expect(overlayClassName).toContain("bg-black/40")
    expect(overlayClassName).toContain("dark:bg-black/50")
    expect(overlayClassName).toContain("backdrop-blur-[2px]")
    expect(overlayClassName).not.toContain("backdrop-blur-sm")
  })

  it("maps dialog sizes to consistent max-widths", () => {
    expect(dialogSizeClassName("sm")).toBe("sm:max-w-sm")
    expect(dialogSizeClassName("md")).toBe("sm:max-w-lg")
    expect(dialogSizeClassName("lg")).toBe("sm:max-w-2xl")
    expect(dialogSizeClassName("xl")).toBe("sm:max-w-4xl")
    expect(dialogSizeClassName()).toBe("sm:max-w-lg")
  })

  it("ignores dismiss events from portaled selects and menus", () => {
    const floating = document.createElement("div")
    floating.setAttribute("data-radix-popper-content-wrapper", "")
    const option = document.createElement("div")
    floating.appendChild(option)
    document.body.appendChild(floating)

    expect(isDismissEventFromFloatingLayer(option)).toBe(true)
    expect(isDismissEventFromFloatingLayer(document.body)).toBe(false)

    const event = {
      target: option,
      prevented: false,
      preventDefault() {
        this.prevented = true
      },
    }
    expect(preventDismissFromFloatingLayer(event)).toBe(true)
    expect(event.prevented).toBe(true)

    floating.remove()
  })
})
