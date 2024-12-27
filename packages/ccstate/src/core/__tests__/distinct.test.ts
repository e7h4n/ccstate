import { expect, it, vi } from 'vitest';
import { command, computed, state } from '../signal/factory';
import { getDefaultStore } from '../store/store';

it('default state & computed is distincted', () => {
  const base$ = state(0);
  const computed$ = computed((get) => get(base$));

  const traceBase = vi.fn();
  const traceComputed = vi.fn();
  getDefaultStore().sub(base$, command(traceBase));
  getDefaultStore().sub(computed$, command(traceComputed));

  getDefaultStore().set(base$, 0);
  expect(traceBase).not.toHaveBeenCalled();
  expect(traceComputed).not.toHaveBeenCalled();
});
