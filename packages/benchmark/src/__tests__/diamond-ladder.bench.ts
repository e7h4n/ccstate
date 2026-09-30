import { bench, describe, type BenchOptions } from 'vitest';
import { createDiamondLadder } from './diamond-ladder';

const options = { time: 1000, iterations: 16, warmupTime: 200, warmupIterations: 4 };

for (const depth of [10, 16, 17, 18, 19, 20]) {
  describe(`unmounted diamond ladder: ${String(depth)} layers, ${String(2 * depth + 1)} computed`, () => {
    let cold = createDiamondLadder(depth);
    let coldValue = 0;
    // Vitest forwards Bench options, not Task options. Install per-iteration
    // hooks through setup so graph construction and assertions are not timed.
    const coldOptions: BenchOptions = {
      ...options,
      setup(task) {
        task.opts.beforeEach = () => {
          cold = createDiamondLadder(depth);
        };
        task.opts.afterEach = () => {
          if (coldValue !== cold.expected || cold.evaluations() !== cold.nodeCount) {
            throw new Error('First read must evaluate each computed exactly once');
          }
        };
      },
    };
    bench(
      'first read (fresh store; construction excluded)',
      () => {
        if (cold.evaluations() !== 0) {
          throw new Error('First read must start with an empty cache');
        }
        coldValue = cold.store.get(cold.root$);
      },
      coldOptions,
    );

    const warm = createDiamondLadder(depth);
    if (warm.store.get(warm.root$) !== warm.expected || warm.evaluations() !== warm.nodeCount) {
      throw new Error('Invalid warm-cache setup');
    }
    let warmValue = 0;
    const warmOptions: BenchOptions = {
      ...options,
      setup(task) {
        task.opts.afterEach = () => {
          if (warmValue !== warm.expected || warm.evaluations() !== warm.nodeCount) {
            throw new Error('Cached reads must not re-evaluate any computed');
          }
        };
      },
    };
    bench(
      'cached read (no writes, no subscriptions)',
      () => {
        warmValue = warm.store.get(warm.root$);
      },
      warmOptions,
    );
  });
}
