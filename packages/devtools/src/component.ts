import { command, computed, getDefaultStore, type Computed, type DebugStore } from 'ccstate';
import { styles } from './styles';
import { html, render } from 'lit-html';
import { createDevtools } from './devtools';

class CCStateDevtools extends HTMLElement {
  private store = getDefaultStore();

  private signals: ReturnType<typeof createDevtools>;

  private container: HTMLDivElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.container = document.createElement('div');
    const style = document.createElement('style');
    style.textContent = styles;
    root.appendChild(style);
    root.appendChild(this.container);

    this.signals = createDevtools();
    this.store.set(this.render$);
    this.store.sub([this.signals.debugStore$, this.signals.computedWatches$, this.signals.graph$], this.render$);
  }

  addDependenciesGraph(computed$: Computed<unknown>) {
    this.store.set(this.signals.pushComputedWatch$, { target: computed$ });
  }

  get debugStore(): DebugStore | null {
    return this.store.get(this.signals.debugStore$);
  }

  set debugStore(store: DebugStore | null) {
    this.store.set(this.signals.setDebugStore$, store);
  }

  private tabs$ = computed((get) => {
    const computedWatches = get(this.signals.computedWatches$);
    return computedWatches.map(
      (watch) => html`<button class="computed-select-button">${watch.target.toString()}</button>`,
    );
  });

  private render$ = command(({ get }) => {
    const debugStore = get(this.signals.debugStore$);
    const tabs = get(this.tabs$);
    const graph = get(this.signals.graph$);

    if (!debugStore) {
      render(html`<div data-testid="debug-store-not-set">Please set debugStore attribute First</div>`, this.container);
      return;
    }

    render(
      html`
        <div>
          <div id="tabs" data-testid="tabs">${tabs}</div>
          <div id="graph" data-testid="graph"></div>
        </div>
      `,
      this.container,
    );

    const graphEl = this.container.querySelector('#graph');
    console.log(graph, graphEl);
    // TODO: render graph to graphEl
  });
}

customElements.define('ccstate-devtools', CCStateDevtools);

declare global {
  interface HTMLElementTagNameMap {
    'ccstate-devtools': CCStateDevtools;
  }
}
