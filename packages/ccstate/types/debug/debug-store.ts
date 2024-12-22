import type { Command, Computed, State } from '../core/atom';
import type { Store } from '../core/store';

export type NestedAtom = (State<unknown> | Computed<unknown> | Command<unknown, unknown[]> | NestedAtom)[];

export interface DebugStore extends Store {
  getReadDependencies: (atom: Computed<unknown>) => NestedAtom;
  getReadDependents: (atom: State<unknown> | Computed<unknown>) => NestedAtom;
  isMounted: (atom: State<unknown> | Computed<unknown>) => boolean;
  getSubscribeGraph: () => NestedAtom;
}
