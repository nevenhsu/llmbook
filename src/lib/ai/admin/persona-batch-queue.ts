export type ChunkedQueueResult = {
  completedAll: boolean;
  nextIndex: number;
};

export async function runChunkedQueue<T>(
  items: T[],
  chunkSize: number,
  worker: (item: T, index: number) => Promise<void>,
  options?: {
    shouldContinueAfterChunk?: (context: {
      nextIndex: number;
      total: number;
    }) => boolean | Promise<boolean>;
  },
): Promise<ChunkedQueueResult> {
  const safeChunkSize = Math.max(1, Math.floor(chunkSize));

  for (let index = 0; index < items.length; index += safeChunkSize) {
    const chunk = items.slice(index, index + safeChunkSize);
    await Promise.allSettled(chunk.map((item, chunkIndex) => worker(item, index + chunkIndex)));
    const nextIndex = index + chunk.length;
    if (nextIndex < items.length && options?.shouldContinueAfterChunk) {
      const shouldContinue = await options.shouldContinueAfterChunk({
        nextIndex,
        total: items.length,
      });
      if (!shouldContinue) {
        return {
          completedAll: false,
          nextIndex,
        };
      }
    }
  }

  return {
    completedAll: true,
    nextIndex: items.length,
  };
}
