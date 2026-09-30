import { computed, createStore, state, type Computed, type Getter } from 'ccstate';

/** Two shared computed nodes per layer, plus one final join: 2 * depth + 1 nodes. */
export function createDiamondLadder(depth: number) {
  const source$ = state(1);
  let evaluations = 0;
  const counted = (read: (get: Getter) => number) =>
    computed((get) => {
      evaluations++;
      return read(get);
    });

  let left$: Computed<number> = counted((get) => get(source$));
  let right$: Computed<number> = counted((get) => get(source$));
  for (let layer = 1; layer < depth; layer++) {
    // Capture this layer's inputs, not the variables reassigned below.
    const previousLeft$ = left$;
    const previousRight$ = right$;
    left$ = counted((get) => get(previousLeft$) + get(previousRight$));
    right$ = counted((get) => get(previousLeft$) + get(previousRight$));
  }
  const root$ = counted((get) => get(left$) + get(right$));

  return {
    store: createStore(),
    source$,
    root$,
    nodeCount: 2 * depth + 1,
    expected: 2 ** depth,
    evaluations: () => evaluations,
  };
}
