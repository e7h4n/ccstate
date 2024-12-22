import { createContext, useContext } from 'solid-js';
import { getDefaultStore } from 'ccstate';
import type { Store } from 'ccstate';

const StoreContext = createContext<Store | null>(null);

export const StoreProvider = StoreContext.Provider;

export function useStore(): Store {
  const store = useContext(StoreContext);

  if (!store) {
    return getDefaultStore();
  }

  return store;
}
