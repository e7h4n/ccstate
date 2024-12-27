import { command, computed, state, type Computed, type DebugStore, type State } from 'ccstate';

export interface ComputedWatch {
  target: Computed<unknown>;
}

export function createDevtools() {
  const internalComputedWatches$: State<ComputedWatch[]> = state([]);
  const internalSelectedWatch$: State<ComputedWatch | null> = state(null);

  const pushComputedWatch$ = command(({ set }, watch: ComputedWatch) => {
    set(internalComputedWatches$, (x) => [...x, watch]);
  });

  const internalDebugStore$: State<DebugStore | null> = state(null);

  const setDebugStore$ = command(({ set }, store: DebugStore | null) => {
    set(internalDebugStore$, store);
  });

  const debugStore$ = computed((get) => get(internalDebugStore$));
  const computedWatches$ = computed((get) => get(internalComputedWatches$));
  const currentWatch$ = computed((get) => {
    const store = get(debugStore$);
    const watches = get(computedWatches$);
    const currentWatch = get(internalSelectedWatch$);

    if (!store || !watches.length) return null;

    if (currentWatch) {
      return currentWatch;
    }

    return watches[0];
  });

  const selectWatch$ = command(({ set }, watch: ComputedWatch) => {
    set(internalSelectedWatch$, watch);
  });

  const graph$ = computed((get) => {
    const store = get(debugStore$);
    const currentWatch = get(currentWatch$);
    if (!store || !currentWatch) return null;

    return {
      title: currentWatch.target.toString(),
      edges: [],
      nodes: new Map(),
    };
  });

  return {
    computedWatches$,
    pushComputedWatch$,
    debugStore$,
    setDebugStore$,
    currentWatch$,
    selectWatch$,
    graph$,
  };
}
