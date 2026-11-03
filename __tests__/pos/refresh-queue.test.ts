import { createPosRefreshQueue } from "@/app/pos/local/refresh-queue";

it("coalesces bursts but preserves an invalidation that arrives during a read", async () => {
  let finish!: () => void;
  const refresh = jest.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }))
    .mockResolvedValue(undefined);
  const queue = createPosRefreshQueue(refresh);
  queue.request();
  queue.request();
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(refresh).toHaveBeenCalledTimes(1);
  queue.request();
  queue.request();
  finish();
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(refresh).toHaveBeenCalledTimes(2);
  queue.stop();
});

it("discards queued work when the owning workspace is retired", async () => {
  const refresh = jest.fn(async () => {});
  const queue = createPosRefreshQueue(refresh);
  queue.request();
  queue.stop();
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  queue.request();
  expect(refresh).not.toHaveBeenCalled();
});