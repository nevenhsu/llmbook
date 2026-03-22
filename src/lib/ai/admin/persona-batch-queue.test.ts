import { describe, expect, it, vi } from "vitest";
import { runChunkedQueue } from "./persona-batch-queue";

function createDeferred() {
  let resolve: (() => void) | null = null;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve: resolve! };
}

async function flushMicrotasks(times = 4) {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
}

describe("runChunkedQueue", () => {
  it("runs items in chunks and waits for the current chunk to settle before advancing", async () => {
    const started: number[] = [];
    const finished: number[] = [];
    const deferredByItem = new Map<number, ReturnType<typeof createDeferred>>();

    const worker = vi.fn(async (item: number) => {
      started.push(item);
      const deferred = createDeferred();
      deferredByItem.set(item, deferred);
      await deferred.promise;
      finished.push(item);
    });

    const runPromise = runChunkedQueue([1, 2, 3, 4, 5], 2, worker);

    await flushMicrotasks();
    expect(started).toEqual([1, 2]);

    deferredByItem.get(1)?.resolve();
    await flushMicrotasks();
    expect(started).toEqual([1, 2]);

    deferredByItem.get(2)?.resolve();
    await flushMicrotasks();
    expect(finished).toEqual([1, 2]);
    expect(started).toEqual([1, 2, 3, 4]);

    deferredByItem.get(3)?.resolve();
    deferredByItem.get(4)?.resolve();
    await flushMicrotasks();
    expect(started).toEqual([1, 2, 3, 4, 5]);

    deferredByItem.get(5)?.resolve();
    await runPromise;

    expect(finished).toEqual([1, 2, 3, 4, 5]);
    expect(worker).toHaveBeenCalledTimes(5);
  });

  it("can stop after the current chunk settles and report the next remaining index", async () => {
    const started: number[] = [];
    const deferredByItem = new Map<number, ReturnType<typeof createDeferred>>();

    const worker = vi.fn(async (item: number) => {
      started.push(item);
      const deferred = createDeferred();
      deferredByItem.set(item, deferred);
      await deferred.promise;
    });

    const runPromise = runChunkedQueue([1, 2, 3, 4, 5], 2, worker, {
      shouldContinueAfterChunk: ({ nextIndex }) => nextIndex < 2,
    });

    await flushMicrotasks();
    expect(started).toEqual([1, 2]);

    deferredByItem.get(1)?.resolve();
    deferredByItem.get(2)?.resolve();
    await flushMicrotasks();

    await expect(runPromise).resolves.toEqual({
      completedAll: false,
      nextIndex: 2,
    });
    expect(worker).toHaveBeenCalledTimes(2);
  });
});
