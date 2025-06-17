import type { ComputedState, SignalState, StoreInterceptor } from '../../types/core/store';
import type { DebugStore, Edge, NestedAtom } from '../../types/debug/debug-store';
import type { Computed, State } from '../core';
import { StoreImpl } from '../core/store/store';
import { canReadAsCompute } from '../core/typing-util';

export class DebugStoreImpl extends StoreImpl implements DebugStore {
  getReadDependencies = (atom: State<unknown> | Computed<unknown>): NestedAtom => {
    const atomState = this.context.stateMap.get(atom);
    if (!atomState) {
      return [atom];
    }

    if (!('dependencies' in atomState)) {
      return [atom];
    }

    return [
      atom,
      ...Array.from(atomState.dependencies).map(([key]) => {
        return this.getReadDependencies(key);
      }),
    ] as NestedAtom;
  };

  getReadDependents = (atom: State<unknown> | Computed<unknown>): NestedAtom => {
    const atomState = this.context.stateMap.get(atom);
    if (!atomState) {
      return [atom];
    }

    return [
      atom,
      ...Array.from(atomState.mounted?.readDepts ?? []).map((key) => this.getReadDependents(key)),
    ] as NestedAtom;
  };

  isMounted = (atom: State<unknown> | Computed<unknown>): boolean => {
    const mountState = this.stateMap.get(atom);
    return mountState?.mounted !== undefined;
  };

  getDependenciesGraph = (computed$: Computed<unknown>): Edge[] => {
    const stateMap = this.context.stateMap;
    function fillDependenciesGraph(computed$: Computed<unknown>, result: Edge[]) {
      const computedState = stateMap.get(computed$) as ComputedState<unknown>;
      for (const [child$, epoch] of computedState.dependencies.entries()) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-non-null-assertion
        const childState = stateMap.get(child$)! as SignalState<unknown>;
        result.push([
          {
            signal: computed$,
            val: computedState.val,
            epoch: computedState.epoch,
          },
          {
            signal: child$,
            val: childState.val,
            epoch: childState.epoch,
          },
          epoch,
        ]);
        if (canReadAsCompute(child$)) {
          fillDependenciesGraph(child$, result);
        }
      }
    }

    const result: Edge[] = [];
    fillDependenciesGraph(computed$, result);
    return result;
  };
}

export function createDebugStoreInternal(interceptor?: StoreInterceptor): DebugStore {
  return new DebugStoreImpl({
    interceptor: interceptor,
  });
}
