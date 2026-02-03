type AsyncWorker<TInput> = (item: TInput) => Promise<void>;

const runWithConcurrency = async <TInput>(
  items: ReadonlyArray<TInput>,
  concurrency: number,
  worker: AsyncWorker<TInput>,
): Promise<void> => {
  const resolvedConcurrency = Math.max(1, Math.floor(concurrency));
  let index = 0;
  const runners: Promise<void>[] = [];

  const runNext = async (): Promise<void> => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const current = index;

      index += 1;

      if (current >= items.length) {
        return;
      }

      const item = items[current];

      if (item === undefined) {
        return;
      }

      await worker(item);
    }
  };

  for (let i = 0; i < Math.min(resolvedConcurrency, items.length); i += 1) {
    runners.push(runNext());
  }

  await Promise.all(runners);
};

export { runWithConcurrency };
