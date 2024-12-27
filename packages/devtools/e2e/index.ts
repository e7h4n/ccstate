import { computed, createDebugStore, state } from 'ccstate';
import '..';

const debugStore = createDebugStore();

const devtools = document.createElement('ccstate-devtools');
document.body.appendChild(devtools);
devtools.debugStore = debugStore;

const base$ = state(0, {
  debugLabel: 'base$',
});
const derived$ = computed((get) => get(base$) + 1, {
  debugLabel: 'derived$',
});
debugStore.get(derived$);

devtools.addDependenciesGraph(derived$);
