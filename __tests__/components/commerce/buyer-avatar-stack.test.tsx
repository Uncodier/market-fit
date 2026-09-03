import { render } from "@testing-library/react"
import { BuyerAvatarStack } from "../../../app/components/commerce/BuyerAvatarStack"

describe("BuyerAvatarStack", () => {
  it("renders null if no buyers provided", () => {
    const { container } = render(<BuyerAvatarStack buyers={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders up to 4 buyers with correct stacking styles", () => {
    const buyers = [
      { id: "1", name: "A", avatar_url: null },
      { id: "2", name: "B", avatar_url: null },
      { id: "3", name: "C", avatar_url: null },
      { id: "4", name: "D", avatar_url: null },
      { id: "5", name: "E", avatar_url: null },
    ]
    const { container } = render(<BuyerAvatarStack buyers={buyers} />)
    const containerDivs = container.firstChild as HTMLElement
    expect(containerDivs.childNodes.length).toBe(4) // Only 4 should be rendered

    // Check stacking negative margin on items > 0
    const firstAvatar = containerDivs.childNodes[0] as HTMLElement
    const secondAvatar = containerDivs.childNodes[1] as HTMLElement
    expect(firstAvatar.className).not.toContain("-ml-2")
    expect(secondAvatar.className).toContain("-ml-2")
  })
})
