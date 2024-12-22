import { inject, provide, type InjectionKey } from 'vue';
import type { Store } from 'ccstate';

export const StoreKey = Symbol('ccstate-vue-store') as InjectionKey<Store>;

export const provideStore = (store: Store) => {
  provide(StoreKey, store);
};

export const useStore = (): Store => {
  const store = inject(StoreKey);
  if (store === undefined) {
    throw new Error('Store context not found - did you forget to wrap your app with StoreProvider?');
  }

  return store;
};
