import { command, createStore } from 'ccstate';
import { initialize$ as initializeInspectPanel$ } from './atoms/chrome/inspect-panel';

const createDevtoolsRootSignal$ = command(() => {
  const controller = new AbortController();
  window.addEventListener(
    'beforeunload',
    () => {
      controller.abort();
    },
    {
      signal: controller.signal,
    },
  );

  const onNavigate = () => {
    if (controller.signal.aborted) {
      return;
    }
    controller.abort();
  };

  chrome.devtools.network.onNavigated.addListener(onNavigate);
  controller.signal.addEventListener('abort', () => {
    chrome.devtools.network.onNavigated.removeListener(onNavigate);
  });

  return controller.signal;
});

const store = createStore();

const init = () => {
  const signal = store.set(createDevtoolsRootSignal$);
  void store.set(initializeInspectPanel$, signal);
};

chrome.devtools.network.onNavigated.addListener(init);
init();
console.warn('[CCState] Devtools initialized');
