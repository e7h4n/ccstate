/* eslint-disable @typescript-eslint/no-deprecated */
import type { ComputedState, SignalState, StoreInterceptor, SubscribeOptions } from '../../types/core/store';
import type { DebugStore, Edge, NestedAtom } from '../../types/debug/debug-store';
import type { Computed, Command, Subscribe, State } from '../core';
import { StoreImpl } from '../core/store/store';
import { canReadAsCompute } from '../core/typing-util';

export class DebugStoreImpl extends StoreImpl implements DebugStore {
  private readonly mountedAtomListenersCount = new Map<State<unknown> | Computed<unknown>, number>();

  override sub: Subscribe = (
    atoms: (State<unknown> | Computed<unknown>)[] | (State<unknown> | Computed<unknown>),
    cb: Command<unknown, unknown[]>,
    options?: SubscribeOptions,
  ): (() => void) => {
    const atomList = Array.isArray(atoms) ? atoms : [atoms];

    atomList.forEach((atom) => {
      this.mountedAtomListenersCount.set(atom, (this.mountedAtomListenersCount.get(atom) ?? 0) + 1);
    });

    const unsub = super.sub(atoms, cb, options);
    const decount = () => {
      atomList.forEach((atom) => {
        const count = this.mountedAtomListenersCount.get(atom) ?? 0;
        if (count === 0) {
          return;
        }

        this.mountedAtomListenersCount.set(atom, count - 1);
        if (count === 1) {
          this.mountedAtomListenersCount.delete(atom);
        }
      });
    };
    options?.signal?.addEventListener('abort', decount);
    return () => {
      unsub();
      decount();
    };
  };

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

  getSubscribeGraph = (): NestedAtom => {
    const subscribedAtoms = Array.from(this.mountedAtomListenersCount.keys());
    return subscribedAtoms.map((atom) => {
      const atomState = this.context.stateMap.get(atom);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const listeners = Array.from(atomState!.mounted!.listeners);
      return [atom, ...listeners];
    });
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
