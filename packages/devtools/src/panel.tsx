import { StoreInspector } from './components/store-inspector';
import { StoreProvider, type DevToolsHookMessage, type Store } from 'rippling';
import type { ReactNode } from 'react';
import { clearEvents$, onEvent$ } from './atoms/events';

export function setupUI(render: (children: ReactNode) => void, store: Store) {
  render(
    <>
      <StoreProvider value={store}>
        <StoreInspector />
      </StoreProvider>
    </>,
  );
}

export function setupStore(store: Store, window: Window) {
  window.addEventListener('message', ({ data }: { data: DevToolsHookMessage | undefined | 'knockknock' }) => {
    if (data === 'knockknock') {
      store.set(clearEvents$);
      return;
    }

    if (!data || !('source' in data) || (data as unknown as { source: string }).source !== 'rippling-store-inspector') {
      return;
    }

    store.set(onEvent$, data.payload);
  });
}
