import { it, vi, expect } from 'vitest';
import { state, computed, command, createDebugStore } from '../..';

it('test glitch 1', () => {
  const base$ = state(0, { debugLabel: 'base$' });
  const basePlusZero$ = computed((get) => get(base$), { debugLabel: 'basePlusZero$' });
  const basePlusOne$ = computed((get) => get(basePlusZero$) + 1, { debugLabel: 'basePlusOne$' });
  const trace = vi.fn();
  const alwaysTrue$ = computed(
    (get) => {
      const basePlusZero = get(basePlusZero$);
      const ret = get(basePlusOne$) > basePlusZero;
      trace(ret);
      return ret;
    },
    { debugLabel: 'alwaysTrue$' },
  );

  const store = createDebugStore([/./]);
  store.sub(
    alwaysTrue$,
    command(() => void 0),
  );

  expect(store.get(alwaysTrue$)).toBe(true);
  trace.mockClear();
  store.set(base$, 1);
  expect(trace).not.toHaveBeenCalledWith(false);
  expect(trace).toBeCalledTimes(1);
});

it('test glitch 2', () => {
  const base$ = state(0, { debugLabel: 'base$' });
  const basePlusZero$ = computed((get) => get(base$), { debugLabel: 'basePlusZero$' });
  const basePlusOne$ = computed((get) => get(basePlusZero$) + 1, { debugLabel: 'basePlusOne$' });
  const trace = vi.fn();
  const alwaysTrue$ = computed(
    (get) => {
      const ret = get(basePlusOne$) > get(basePlusZero$);
      trace(ret);
      return ret;
    },
    { debugLabel: 'alwaysTrue$' },
  );

  const store = createDebugStore([/./]);
  store.sub(
    alwaysTrue$,
    command(() => void 0),
  );

  expect(store.get(alwaysTrue$)).toBe(true);
  trace.mockClear();
  store.set(base$, 1);
  expect(trace).not.toHaveBeenCalledWith(false);
  expect(trace).toBeCalledTimes(1);
});
