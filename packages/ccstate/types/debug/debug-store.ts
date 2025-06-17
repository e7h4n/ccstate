import type { Command, Computed, Signal, State } from '../core/signal';
import type { Store } from '../core/store';

export type NestedAtom = (State<unknown> | Computed<unknown> | Command<unknown, unknown[]> | NestedAtom)[];
export interface DAGNode<T> {
  signal: Signal<T>;
  val: T;
  epoch: number;
}
export type Edge = [DAGNode<unknown>, DAGNode<unknown>, number];

export interface DebugStore extends Store {
  getReadDependencies: (atom: Computed<unknown>) => NestedAtom;
  getDependenciesGraph: (atom: Computed<unknown>) => Edge[];
  getReadDependents: (atom: State<unknown> | Computed<unknown>) => NestedAtom;
  isMounted: (atom: State<unknown> | Computed<unknown>) => boolean;
}
