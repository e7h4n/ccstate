import { command, computed, state, type Computed, type DebugStore, type State } from 'ccstate';

interface ComputedWatch {
  target: Computed<unknown>;
}

export function createDevtools() {
  const internalComputedWatches$: State<ComputedWatch[]> = state([]);

  const pushComputedWatch$ = command(({ set }, watch: ComputedWatch) => {
    set(internalComputedWatches$, (x) => [...x, watch]);
  });

  const internalDebugStore$: State<DebugStore | null> = state(null);

  const setDebugStore$ = command(({ set }, store: DebugStore | null) => {
    set(internalDebugStore$, store);
  });

  const debugStore$ = computed((get) => get(internalDebugStore$));
  const computedWatches$ = computed((get) => get(internalComputedWatches$));

  return {
    computedWatches$,
    pushComputedWatch$,
    debugStore$,
    setDebugStore$,
  };
}
