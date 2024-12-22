import { createContext, useContext } from 'react';
import type { Store } from 'ccstate';

const StoreContext = createContext<Store | null>(null);

export const StoreProvider = StoreContext.Provider;

export function useStore(): Store {
  const store = useContext(StoreContext);

  if (!store) {
    throw new Error('Store context not found - did you forget to wrap your app with StoreProvider?');
  }

  return store;
}
