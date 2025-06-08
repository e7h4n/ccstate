import { command, computed, state } from 'ccstate';

const internalFloatingPromises$ = state(new Set<Promise<unknown>>());

export const collectFloatingPromise$ = command(({ set }, promise: Promise<unknown>, signal: AbortSignal) => {
  signal.addEventListener('abort', () => {
    set(internalFloatingPromises$, (prev) => {
      const ret = new Set(prev);
      ret.delete(promise);
      return ret;
    });
  });

  set(internalFloatingPromises$, (prev) => {
    const ret = new Set(prev);
    ret.add(promise);
    return ret;
  });
});

export const floatingPromises$ = computed((get) => {
  return get(internalFloatingPromises$);
});

export const asyncGetSettled$ = computed(async (get) => {
  return await Promise.all(get(floatingPromises$));
});
