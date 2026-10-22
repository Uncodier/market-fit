import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useSystemLocalization } from "@/app/context/use-system-localization"

function RecoveryScreen({ reset }: { reset: () => void }) {
  const { locale, t } = useSystemLocalization()
  return <div lang={locale}>
    <h1>{t("system.error.title")}</h1>
    <button onClick={reset}>{t("system.error.retry")}</button>
  </div>
}

describe("provider-independent error localization", () => {
  afterEach(() => {
    cleanup()
    document.documentElement.lang = "en"
  })

  it("follows the document language without requiring a working provider", async () => {
    document.documentElement.lang = "es-MX"
    const reset = jest.fn()
    render(<RecoveryScreen reset={reset} />)
    expect(screen.getByRole("heading", { name: "Se ha producido un error" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }))
    expect(reset).toHaveBeenCalledTimes(1)

    await act(async () => {
      document.documentElement.lang = "en"
      await Promise.resolve()
    })
    expect(screen.getByRole("heading", { name: "An error occurred" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("retains a readable English fallback for incomplete system dictionaries", () => {
    document.documentElement.lang = "ja"
    render(<RecoveryScreen reset={jest.fn()} />)
    expect(screen.getByRole("heading", { name: "An error occurred" })).toBeInTheDocument()
  })
})