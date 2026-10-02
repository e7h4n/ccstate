import { bench, describe, type BenchOptions } from 'vitest';
import { createDiamondLadder } from './diamond-ladder';

for (const depth of [4, 8, 12, 16]) {
  describe(`mounted diamond ladder: ${String(depth)} layers, ${String(2 * depth + 1)} computed`, () => {
    const graph = createDiamondLadder(depth);
    let value = 1;
    let writes = 0;
    let observedValue = 0;
    let notifications = 0;
    graph.store.watch(graph.root$, () => {
      observedValue = graph.store.get(graph.root$);
      notifications++;
    });
    const options: BenchOptions = {
      time: 1000,
      iterations: 16,
      warmupTime: 200,
      warmupIterations: 4,
      setup(task) {
        // Tinybench per-iteration hooks are installed through Vitest's setup.
        // Validate propagation outside the measured write, including warmup.
        task.opts.afterEach = () => {
          if (
            observedValue !== graph.expected * value ||
            notifications !== writes + 1 ||
            graph.evaluations() !== graph.nodeCount * (writes + 1)
          ) {
            throw new Error('Each write must evaluate each computed once and notify the root once');
          }
        };
      },
    };
    bench(
      'write (graph already mounted; construction excluded)',
      () => {
        value = value === 1 ? 2 : 1;
        writes++;
        graph.store.set(graph.source$, value);
      },
      options,
    );
  });
}
