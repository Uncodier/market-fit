import { EscPosBuilder, qrCommandPrefix, wrapText, padLine } from "../../../lib/printer/core/escpos"

describe("escpos helpers", () => {
  it("wraps long text to the printer width", () => {
    expect(wrapText("one two three four", 10)).toEqual(["one two", "three four"])
  })

  it("pads left and right values on one line", () => {
    expect(padLine("Burger", "12.00", 16)).toBe("Burger     12.00")
  })

  it("emits init, QR prefix, and cut commands", () => {
    const builder = new EscPosBuilder(80)
    builder.text("Hello").qr("SKU-1").cut()
    const bytes = Array.from(builder.build())
    expect(bytes.slice(0, 2)).toEqual([0x1b, 0x40])
    const prefix = qrCommandPrefix()
    const idx = bytes.findIndex(
      (b, i) =>
        b === prefix[0] && bytes[i + 1] === prefix[1] && bytes[i + 2] === prefix[2],
    )
    expect(idx).toBeGreaterThan(0)
    expect(bytes.slice(-3)).toEqual([0x1d, 0x56, 0x00])
  })
})
