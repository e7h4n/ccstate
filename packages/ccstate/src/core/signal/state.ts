import type { State } from '../../../types/core/signal';
import type { StateState, StoreContext } from '../../../types/core/store';

export function readState<T>(state: State<T>, context: StoreContext): StateState<T> {
  const atomState = context.stateMap.get(state);
  if (!atomState) {
    const initState = {
      val: state.init,
      epoch: 0,
    };
    context.stateMap.set(state, initState);
    return initState as StateState<T>;
  }

  return atomState as StateState<T>;
}
