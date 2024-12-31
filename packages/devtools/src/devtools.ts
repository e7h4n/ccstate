import { command, computed, state, type Computed, type DebugStore, type State } from 'ccstate';

export interface ComputedWatch {
  target: Computed<unknown>;
}

export interface DAGGraph {
  title: string;
  edges: [number, number, unknown][];
  nodes: Map<
    number,
    {
      label: string;
      shape: string;
      data: {
        epoch: number;
        value: unknown;
      };
    }
  >;
}

function nodeToCytoscapeNode(node: { signal: Computed<unknown> | State<unknown>; epoch: number; val: unknown }) {
  return {
    label: node.signal.toString(),
    shape: 'read' in node.signal ? 'circle' : 'square',
    data: {
      epoch: node.epoch,
      value: node.val,
    },
  };
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

  const internalGraphRefresh$ = state(0);
  const refreshGraph$ = command(({ set }) => {
    set(internalGraphRefresh$, (x) => x + 1);
  });

  const graph$ = computed<DAGGraph | null>((get) => {
    get(internalGraphRefresh$);

    const store = get(debugStore$);
    const currentWatch = get(currentWatch$);
    if (!store || !currentWatch) return null;

    const graph = store.getDependenciesGraph(currentWatch.target);

    return {
      title: currentWatch.target.toString(),
      edges: graph.map(([from, to, value]) => [from.signal.id, to.signal.id, value]),
      nodes: graph.reduce(
        (prev, curr) => {
          if (!prev.has(curr[0].signal.id)) {
            prev.set(curr[0].signal.id, nodeToCytoscapeNode(curr[0]));
          }
          if (!prev.has(curr[1].signal.id)) {
            prev.set(curr[1].signal.id, nodeToCytoscapeNode(curr[1]));
          }

          return prev;
        },
        new Map<
          number,
          {
            label: string;
            shape: string;
            data: {
              epoch: number;
              value: unknown;
            };
          }
        >(),
      ),
    } satisfies DAGGraph;
  });

  return {
    computedWatches$,
    pushComputedWatch$,
    debugStore$,
    setDebugStore$,
    currentWatch$,
    selectWatch$,
    graph$,
    refreshGraph$,
  };
}
