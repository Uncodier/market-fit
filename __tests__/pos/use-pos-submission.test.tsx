import { act, renderHook } from "@testing-library/react";
import { usePosSubmission } from "@/app/pos/hooks/use-pos-submission";

it("keeps synchronous duplicate admission closed but scopes it to the selected order/session", () => {
  let session = "first";
  const { result, rerender } = renderHook(({ key }) => usePosSubmission(key, () => session), { initialProps: { key: "order" } });
  let finishOld!: () => void;
  act(() => {
    finishOld = result.current.begin();
    expect(result.current.busy()).toBe(true);
  });
  expect(result.current.loading).toBe(true);
  session = "new-order";
  rerender({ key: "new" });
  expect(result.current.loading).toBe(false);
  let finishNew!: () => void;
  act(() => { finishNew = result.current.begin(); });
  act(() => finishOld());
  expect(result.current.loading).toBe(true);
  expect(result.current.busy()).toBe(true);
  act(() => finishNew());
  expect(result.current.loading).toBe(false);
});