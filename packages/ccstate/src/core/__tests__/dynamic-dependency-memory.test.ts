import LeakDetector from 'jest-leak-detector';
import { describe, expect, it } from 'vitest';
import { computed, createStore, state } from '..';
import type { Computed, Getter, State } from '..';
import { StoreImpl } from '../store/store';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function readOldSource(get: Getter, source: State<{ value: number }> | undefined) {
  if (!source) throw new Error('The old branch was read after its source was released');
  return get(source).value;
}

// Keep the store, computed and watcher alive. Only the obsolete branch is
// released, so this cannot pass merely because the entire graph was collected.
describe('dynamic dependency memory with an active watcher', () => {
  it.each(['sync', 'before await', 'after await'] as const)(
    'releases the old signal and payload after a branch switch (%s)',
    async (mode) => {
      const store = createStore();
      const branch = state(false);
      let oldSource: State<{ value: number; payload: object }> | undefined = state({ value: 1, payload: {} });
      const signalDetector = new LeakDetector(oldSource);
      const payloadDetector = new LeakDetector(store.get(oldSource).payload);
      const currentSource = state({ value: 2 });
      let reads = 0;
      const read = (get: Getter) => {
        reads += 1;
        return get(branch) ? get(currentSource).value : readOldSource(get, oldSource);
      };
      const value: Computed<number | Promise<number>> =
        mode === 'sync'
          ? computed(read)
          : computed(async (get) => {
              if (mode === 'before await') {
                const result = read(get);
                await Promise.resolve();
                return result;
              }
              // Track the branch before suspending, and the payload after it.
              const selected = get(branch);
              reads += 1;
              await Promise.resolve();
              return selected ? get(currentSource).value : readOldSource(get, oldSource);
            });
      const controller = new AbortController();
      const unsubscribeWatch1 = store.watch(value, () => undefined);
      try {
        expect(await store.get(value)).toBe(1);
        store.set(branch, true);
        expect(await store.get(value)).toBe(2);
        const readsAfterSwitch = reads;
        store.set(oldSource, (previous) => ({ ...previous, value: 99 }));
        expect(reads).toBe(readsAfterSwitch);
        oldSource = undefined;

        expect(controller.signal.aborted).toBe(false);
        expect(await signalDetector.isLeaking()).toBe(false);
        expect(await payloadDetector.isLeaking()).toBe(false);

        // The new branch is still mounted and reactive after collection.
        store.set(currentSource, { value: 3 });
        expect(reads).toBe(readsAfterSwitch + 1);
        expect(await store.get(value)).toBe(3);
      } finally {
        unsubscribeWatch1();
      }
    },
  );

  it.each(['before await', 'after await'] as const)(
    'an obsolete evaluation settling last cannot reattach its old dependency (%s)',
    async (mode) => {
      // Count lifecycle events without retaining the signals in a spy or log.
      let oldMounts = 0;
      const store = new StoreImpl({
        interceptor: {
          mount: (signal) => {
            if (signal.debugLabel === 'obsolete-source') oldMounts += 1;
          },
          unmount: (signal) => {
            if (signal.debugLabel === 'obsolete-source') oldMounts -= 1;
          },
        },
      });
      const branch = state(false);
      let oldSource: State<{ value: number; payload: object }> | undefined = state(
        { value: 1, payload: {} },
        { debugLabel: 'obsolete-source' },
      );
      const signalDetector = new LeakDetector(oldSource);
      const payloadDetector = new LeakDetector(store.get(oldSource).payload);
      const currentSource = state({ value: 2 });
      const oldGate = deferred();
      let reads = 0;
      const value = computed(async (get) => {
        reads += 1;
        if (get(branch)) return get(currentSource).value;
        if (mode === 'before await') {
          const result = readOldSource(get, oldSource);
          await oldGate.promise;
          return result;
        }
        await oldGate.promise;
        return readOldSource(get, oldSource);
      });
      const controller = new AbortController();
      const unsubscribeWatch2 = store.watch(value, () => undefined);
      try {
        const oldPromise = store.get(value);
        store.set(branch, true);
        const currentPromise = store.get(value);
        expect(await currentPromise).toBe(2);
        expect(reads).toBe(2);

        // Complete the old evaluation only after the current one has settled.
        oldGate.resolve();
        expect(await oldPromise).toBe(1);
        expect(oldMounts).toBe(0);
        expect(store.get(value)).toBe(currentPromise);
        store.set(oldSource, (previous) => ({ ...previous, value: 99 }));
        expect(reads).toBe(2);
        expect(await store.get(value)).toBe(2);
        oldSource = undefined;

        expect(controller.signal.aborted).toBe(false);
        expect(await signalDetector.isLeaking()).toBe(false);
        expect(await payloadDetector.isLeaking()).toBe(false);
        store.set(currentSource, { value: 3 });
        expect(reads).toBe(3);
        expect(await store.get(value)).toBe(3);
      } finally {
        oldGate.resolve();
        unsubscribeWatch2();
      }
    },
  );
});
