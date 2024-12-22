import type { Strategy } from './strategy/type';

function fib(n: number): number {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

function deriveAtoms<T, S>(atoms: T[], childCount: number, strategy: Strategy<T, S>): T[][] {
  let pendingAtoms: T[] = [...atoms];
  const result: T[][] = [];

  while (pendingAtoms.length > 1) {
    result.push(pendingAtoms);
    const derivedAtoms: T[] = [];

    for (let i = 0; i < pendingAtoms.length / childCount; i++) {
      const innerAtoms: T[] = [];
      for (let j = 0; j < childCount && i * childCount + j < pendingAtoms.length; j++) {
        innerAtoms.push(pendingAtoms[i * childCount + j]);
      }

      const derived = strategy.createComputed((get) => {
        let total = 0;
        for (const atom of innerAtoms) {
          total += get(atom);
        }
        return total;
      });

      derivedAtoms.push(derived);
    }
    pendingAtoms = derivedAtoms;
  }

  result.push(pendingAtoms);
  return result;
}

export function setupStore<T, S>(scale: number, strategy: Strategy<T, S>) {
  const store = strategy.createStore();
  const values: T[] = [];
  for (let i = 0; i < Math.pow(10, scale); i++) {
    values.push(strategy.createValue(i));
  }

  const atoms = deriveAtoms(values, 10, strategy);
  const cleanups: (() => void)[] = [];

  for (let i = 1; i < atoms.length; i++) {
    const levelAtoms = atoms[i];
    for (let j = 0; j < levelAtoms.length / 10; j++) {
      const atom = levelAtoms[j * 10];
      cleanups.push(
        strategy.sub(store, atom, () => {
          strategy.get(store, atom);
          fib(10);
        }),
      );
    }
  }

  const cleanup = () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };

  return { store, atoms, cleanup };
}

export function setupStoreWithoutSub<T, S>(scale: number, strategy: Strategy<T, S>) {
  const store = strategy.createStore();
  const values: T[] = [];
  for (let i = 0; i < Math.pow(10, scale); i++) {
    values.push(strategy.createValue(i));
  }

  const atoms = deriveAtoms(values, 10, strategy);

  return { store, atoms };
}
