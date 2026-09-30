import React from "react"
import { act, renderHook } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import { useCreateSiteForm } from "@/app/components/site/use-create-site-form"
import { useCopywritingSection } from "@/app/components/settings/use-copywriting-section"
import type { SiteFormValues } from "@/app/components/settings/form-schema"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: null }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/context/copywriting-actions", () => ({ copywritingService: { getCopywritingItems: jest.fn() } }))

describe("extracted shared form controllers", () => {
  it("submits focus and competitors through site settings without dropping locations", async () => {
    const onSubmit = jest.fn()
    const { result } = renderHook(() => useCreateSiteForm({ onSubmit }))
    await act(async () => {
      await result.current.handleSubmit({ name: "Example", url: "https://example.com", focusMode: 75, competitors: [{ name: "Peer", url: "https://peer.example" }], locations: [{ name: "Main", type: "physical" }], resource_urls: [] })
    })
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: "Example",
      settings: { focus_mode: 75, competitors: [{ name: "Peer", url: "https://peer.example" }], locations: [{ name: "Main", type: "physical" }] },
    }))
  })

  it("keeps new copywriting entries compatible with the form schema", () => {
    function Wrapper({ children }: { children: React.ReactNode }) {
      const form = useForm<SiteFormValues>({ defaultValues: { copywriting: [] } })
      return <FormProvider {...form}>{children}</FormProvider>
    }
    const { result } = renderHook(() => useCopywritingSection({ active: false }), { wrapper: Wrapper })
    act(() => result.current.addCopywritingItem())
    expect(result.current.copywritingList).toEqual([expect.objectContaining({ title: "", tags: [], status: "draft", copy_type: "other" })])
    act(() => result.current.removeCopywritingItem(0))
    expect(result.current.copywritingList).toEqual([])
  })
})