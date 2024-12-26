import { computed } from 'ccstate';
import '../';
import { afterEach, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { screen } from 'shadow-dom-testing-library';
import { createDebugStore } from 'ccstate/debug';

afterEach(() => {
  document.body.innerHTML = '';
});

it('shows prompt when root is not set', () => {
  const devTools = document.createElement('ccstate-devtools');
  document.body.appendChild(devTools);

  expect(screen.getByShadowText('Please set debugStore attribute First')).toBeInTheDocument();
});

it('shows tab list after setting store', () => {
  const devTools = document.createElement('ccstate-devtools');
  document.body.appendChild(devTools);

  const store = createDebugStore();
  devTools.debugStore = store;

  expect(screen.getByShadowTestId('tabs')).toBeInTheDocument();
  expect(devTools.debugStore).toBe(store);
});

it('adds tab content after adding watch', () => {
  const devTools = document.createElement('ccstate-devtools');
  document.body.appendChild(devTools);

  devTools.debugStore = createDebugStore();
  const derived$ = computed(() => 0, {
    debugLabel: 'derived$',
  });
  devTools.addDependenciesGraph(derived$);

  expect(screen.getByShadowText(/derived\$/)).toBeInTheDocument();
});
