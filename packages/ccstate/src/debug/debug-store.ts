import type { Signal } from '../../types/core/atom';
import type { StoreInterceptor, SubscribeOptions } from '../../types/core/store';
import type { DebugStore, NestedAtom, PropagationEdge } from '../../types/debug/debug-store';
import type { Computed, Command, Subscribe, State } from '../core';
import { AtomManager, ListenerManager } from '../core/atom-manager';
import { StoreImpl } from '../core/store';

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
    const atomState = this.atomManager.readAtomState(atom);

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
    const atomState = this.atomManager.readAtomState(atom);
    return [
      atom,
      ...Array.from(atomState.mounted?.readDepts ?? []).map((key) => this.getReadDependents(key)),
    ] as NestedAtom;
  };

  getSubscribeGraph = (): NestedAtom => {
    const subscribedAtoms = Array.from(this.mountedAtomListenersCount.keys());
    return subscribedAtoms.map((atom) => {
      const atomState = this.atomManager.readAtomState(atom);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- we know it's mounted
      const listeners = Array.from(atomState.mounted!.listeners);
      return [atom, ...listeners];
    });
  };

  isMounted = (atom: State<unknown> | Computed<unknown>): boolean => {
    const mountState = this.atomManager.readAtomState(atom);
    return mountState.mounted !== undefined;
  };

  predictPropagationGraph = (state: Signal<unknown>): PropagationEdge[] => {
    const result: PropagationEdge[] = [];
    let atoms = [state];
    let runCount = 0;
    const visited = new Set<Signal<unknown>>();
    while (atoms.length > 0) {
      if (runCount++ > 10) {
        return result;
      }
      const newAtoms: Signal<unknown>[] = [];
      for (const atom of atoms) {
        if (visited.has(atom)) {
          continue;
        }
        visited.add(atom);
        const atomState = this.atomManager.readAtomState(atom);
        const mounted = atomState.mounted;
        if (!mounted) {
          continue;
        }

        mounted.listeners.forEach((l) => {
          result.push([atom, l]);
        });

        mounted.readDepts.forEach((d) => {
          result.push([atom, d]);
          newAtoms.push(d);
        });
      }
      console.log('newAtoms', newAtoms);
      atoms = newAtoms;
    }

    return result;
  };
}

export function createDebugStoreInternal(interceptor?: StoreInterceptor): DebugStore {
  const atomManager = new AtomManager({
    interceptor: interceptor,
  });
  const listenerManager = new ListenerManager();

  return new DebugStoreImpl(atomManager, listenerManager, {
    interceptor: interceptor,
  });
}
