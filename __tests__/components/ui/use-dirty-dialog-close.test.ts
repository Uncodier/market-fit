import { renderHook, act } from "@testing-library/react"
import { useDirtyDialogClose } from "@/app/components/ui/use-dirty-dialog-close"

describe("useDirtyDialogClose", () => {
  it("closes immediately when the form is clean", () => {
    const onOpenChange = jest.fn()
    const { result } = renderHook(() =>
      useDirtyDialogClose({ dirty: false, onOpenChange })
    )

    act(() => {
      result.current.handleOpenChange(false)
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(result.current.discardOpen).toBe(false)
  })

  it("asks to discard when the form is dirty", () => {
    const onOpenChange = jest.fn()
    const { result } = renderHook(() =>
      useDirtyDialogClose({ dirty: true, onOpenChange })
    )

    act(() => {
      result.current.handleOpenChange(false)
    })

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(result.current.discardOpen).toBe(true)

    act(() => {
      result.current.confirmDiscard()
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("blocks close while busy", () => {
    const onOpenChange = jest.fn()
    const { result } = renderHook(() =>
      useDirtyDialogClose({ dirty: false, busy: true, onOpenChange })
    )

    act(() => {
      result.current.requestClose()
    })

    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
