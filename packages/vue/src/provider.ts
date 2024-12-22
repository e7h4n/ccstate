import { inject, provide, type InjectionKey } from 'vue';
import { getDefaultStore } from 'ccstate';
import type { Store } from 'ccstate';

export const StoreKey = Symbol('ccstate-vue-store') as InjectionKey<Store>;

export const provideStore = (store: Store) => {
  provide(StoreKey, store);
};

export const useStore = (): Store => {
  const store = inject(StoreKey);
  if (store === undefined) {
    return getDefaultStore();
  }

  return store;
};
