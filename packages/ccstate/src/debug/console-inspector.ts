import type { SetArgs, StoreEventType, StoreInterceptor } from '../../types/core/store';
import type { DebugStore } from '../../types/debug/debug-store';
import type { Computed, Command, State } from '../core';
import { createDebugStoreInternal } from './debug-store';

export interface AtomWatch {
  target: State<unknown> | Computed<unknown> | Command<unknown, unknown[]> | string | RegExp;
  actions?: Set<StoreEventType>;
}

export class ConsoleInterceptor implements StoreInterceptor {
  constructor(private readonly watches: AtomWatch[]) {}

  private shouldLog = (
    atom: State<unknown> | Computed<unknown> | Command<unknown, unknown[]>,
    action: StoreEventType,
  ) => {
    return this.watches.some((watch) => {
      let atomMatched = false;
      if (typeof watch.target === 'string') {
        atomMatched = atom.toString().includes(watch.target);
      } else if (watch.target instanceof RegExp) {
        atomMatched = watch.target.test(atom.toString());
      } else {
        atomMatched = watch.target === atom;
      }

      if (!atomMatched) {
        return false;
      }

      return !watch.actions || watch.actions.has(action);
    });
  };

  get = <T>(atom$: State<T> | Computed<T>, fn: () => T) => {
    if (!this.shouldLog(atom$, 'get')) {
      fn();
      return;
    }

    console.group('[R][GET] ' + atom$.toString());
    console.log('ret:', fn());
    console.groupEnd();
  };

  computed = <T>(atom$: Computed<T>, fn: () => T) => {
    if (!this.shouldLog(atom$, 'computed')) {
      fn();
      return;
    }

    console.group('[R][CPT] ' + atom$.toString());
    console.log('ret:', fn());
    console.groupEnd();
  };

  set = <T, Args extends SetArgs<T, unknown[]>>(atom$: State<T> | Command<T, Args>, fn: () => T, ...args: Args) => {
    if (!this.shouldLog(atom$ as unknown as State<T>, 'set')) {
      fn();
      return;
    }

    console.group('[R][SET] ' + atom$.toString(), '(', ...args, ')');
    console.log('ret:', fn());
    console.groupEnd();
  };

  mount = <T>(atom$: State<T> | Computed<T>) => {
    if (!this.shouldLog(atom$, 'mount')) {
      return;
    }

    console.log('[R][MNT] ' + atom$.toString());
  };

  unmount = <T>(atom$: State<T> | Computed<T>) => {
    if (!this.shouldLog(atom$, 'unmount')) {
      return;
    }

    console.log('[R][UNM] ' + atom$.toString());
  };
}

export function createDebugStore(
  watches: (AtomWatch | string | RegExp | State<unknown> | Computed<unknown> | Command<unknown, unknown[]>)[] = [],
  defaultActions?: StoreEventType[],
): DebugStore {
  const parsedDefaultActions = defaultActions ? new Set(defaultActions) : undefined;

  const parsedWatches = watches.map((watch): AtomWatch => {
    if (typeof watch === 'string' || watch instanceof RegExp) {
      return { target: watch, actions: parsedDefaultActions };
    }

    if ('target' in watch) {
      return watch;
    }

    return { target: watch, actions: parsedDefaultActions };
  });

  const interceptor = new ConsoleInterceptor(parsedWatches);
  return createDebugStoreInternal(interceptor);
}
