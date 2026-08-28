import { shouldCheckVersion, VERSION_CHECK_THROTTLE_MS } from "@/app/hooks/version-check-policy";

describe("version-check-policy", () => {
  it("returns false if hidden", () => {
    expect(shouldCheckVersion({ now: 1000, lastCheck: 1000, visible: false })).toBe(false);
    expect(shouldCheckVersion({ now: 1000, lastCheck: null, visible: false })).toBe(false);
  });

  it("returns true if no lastCheck and visible", () => {
    expect(shouldCheckVersion({ now: 1000, lastCheck: null, visible: true })).toBe(true);
  });

  it("returns true if elapsed >= VERSION_CHECK_THROTTLE_MS", () => {
    const lastCheck = 1000;
    const now = lastCheck + VERSION_CHECK_THROTTLE_MS;
    expect(shouldCheckVersion({ now, lastCheck, visible: true })).toBe(true);
  });

  it("returns false if elapsed < VERSION_CHECK_THROTTLE_MS", () => {
    const lastCheck = 1000;
    const now = lastCheck + VERSION_CHECK_THROTTLE_MS - 1;
    expect(shouldCheckVersion({ now, lastCheck, visible: true })).toBe(false);
  });
});
