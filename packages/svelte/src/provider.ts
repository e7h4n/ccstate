import type { Store } from 'ccstate';
import { getContext, setContext } from 'svelte';

export const StoreKey = Symbol('ccstate-svelte-store');

export const provideStore = (store: Store) => {
  setContext(StoreKey, store);
};

export const useStore = (): Store => {
  const store = getContext(StoreKey);

  if (!store) {
    throw new Error('useStore must be used within a StoreProvider');
  }

  return store as Store;
};
