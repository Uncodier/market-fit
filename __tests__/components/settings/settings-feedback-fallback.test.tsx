import { setupTranslator } from "@/app/create-site/localized-feedback"

describe("standalone settings feedback", () => {
  it.each(["", "account.setup.background"])("keeps critical notices visible when translation returns %p", missing => {
    const t = setupTranslator(() => missing)
    expect(t("account.setup.background", { status: "failed" })).toBe("Background setup: failed")
  })

  it("retains available localized copy", () => {
    expect(setupTranslator(() => "Configuración pendiente")("account.setup.pending")).toBe("Configuración pendiente")
  })
})