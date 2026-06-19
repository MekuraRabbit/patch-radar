export async function mapWithConcurrency<Input, Output>(
  inputs: readonly Input[],
  concurrency: number,
  mapper: (input: Input, index: number) => Promise<Output>
): Promise<Output[]> {
  if (inputs.length === 0) {
    return [];
  }

  const boundedConcurrency = Math.max(1, Math.min(concurrency, inputs.length));
  const indexedInputs = inputs.map((input, index) => ({ input, index }));
  const results: Output[] = new Array<Output>(inputs.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      const item = indexedInputs[index];

      if (item === undefined) {
        return;
      }

      results[item.index] = await mapper(item.input, item.index);
    }
  }

  await Promise.all(
    Array.from({ length: boundedConcurrency }, async () => worker())
  );

  return results;
}
