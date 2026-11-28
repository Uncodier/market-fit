import { fireEvent, render, screen } from "@testing-library/react"
import { EmojiPicker } from "@/app/components/ui/emoji-picker"
import { loadEmojiCatalog, searchEmojiCatalog } from "@/app/components/ui/emoji-search"

beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })

it("includes every Unicode 17 qualified emoji and component without duplicates", async () => {
  const catalog = await loadEmojiCatalog()
  expect(catalog).toHaveLength(3953)
  expect(new Set(catalog.map(entry => entry.emoji)).size).toBe(catalog.length)
  expect(searchEmojiCatalog(catalog, "🇲🇽")[0].emoji).toBe("🇲🇽")
  expect(searchEmojiCatalog(catalog, "gato").some(entry => entry.emoji === "🐈")).toBe(true)
  expect(searchEmojiCatalog(catalog, "Mexico").some(entry => entry.emoji === "🇲🇽")).toBe(true)
  expect(searchEmojiCatalog(catalog, "👩🏽‍💻")[0].emoji).toBe("👩🏽‍💻")
})

it("focuses the search, finds emojis outside the initial category, and commits the selected symbol", async () => {
  const onChange = jest.fn()
  render(<EmojiPicker onChange={onChange} />)
  fireEvent.click(screen.getByRole("button", { name: "Choose category icon" }))
  const input = screen.getByRole("textbox", { name: "Search emojis" })
  expect(input).toHaveFocus()
  fireEvent.change(input, { target: { value: "mexico" } })
  fireEvent.click(await screen.findByRole("button", { name: "flag: Mexico" }))
  expect(onChange).toHaveBeenCalledWith("🇲🇽")
  expect(screen.queryByRole("textbox", { name: "Search emojis" })).not.toBeInTheDocument()
})