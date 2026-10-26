/** @jest-environment node */
import { checkoutStageTimer, timePosStage, withPosServerTiming } from "@/app/pos/checkout-server-timing";
jest.mock("server-only", () => ({}));

it("records fixed stage durations without result data or error details", async () => {
  const result = await withPosServerTiming(async () => {
    const timer = checkoutStageTimer();
    timer.stage("checkout_auth");
    timer.stage("checkout_admission");
    timer.finish();
    await expect(timePosStage("checkout_lines", async () => { throw new Error("private-token"); })).rejects.toThrow();
    return { email: "private@example.test", token: "private-token" };
  });
  expect(result.serverTiming.split(", ")).toEqual([
    expect.stringMatching(/^pos_total;dur=\d+\.\d$/),
    expect.stringMatching(/^checkout_auth;dur=\d+\.\d$/),
    expect.stringMatching(/^checkout_admission;dur=\d+\.\d$/),
    expect.stringMatching(/^checkout_lines;dur=\d+\.\d$/),
  ]);
  expect(result.serverTiming).not.toMatch(/private|email|token/);
});

it("isolates concurrent requests and rejects dynamic metric names at runtime", async () => {
  const [a, b] = await Promise.all([
    withPosServerTiming(() => timePosStage("checkout_lines", async () => true)),
    withPosServerTiming(() => timePosStage("private-token" as never, async () => false)),
  ]);
  expect(a.value).toBe(true);
  expect(a.serverTiming).toContain("checkout_lines");
  expect(b.value).toBe(false);
  expect(b.serverTiming).toMatch(/^pos_total;dur=\d+\.\d$/);
});

it("does not change direct calls outside an HTTP timing context", async () => {
  expect(await timePosStage("checkout_auth", async () => "result")).toBe("result");
  const timer = checkoutStageTimer();
  timer.stage("checkout_auth");
  timer.finish();
});