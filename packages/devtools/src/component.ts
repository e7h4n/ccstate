import { command, computed, getDefaultStore, type Computed, type DebugStore } from 'ccstate';
import { styles } from './styles';
import { html, render } from 'lit-html';
import { createDevtools, type DAGGraph } from './devtools';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

// eslint-disable-next-line import/no-named-as-default-member
cytoscape.use(dagre);

class CCStateDevtools extends HTMLElement {
  private store = getDefaultStore();

  private signals: ReturnType<typeof createDevtools>;

  private renderController?: AbortController;

  private container: HTMLDivElement;

  constructor() {
    console.log('constructor');
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

  private resetRender$ = command(() => {
    this.renderController?.abort();
    this.renderController = new AbortController();
    return this.renderController.signal;
  });

  private render$ = command(({ get, set }) => {
    const signal = set(this.resetRender$);
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
          <div id="graph" data-testid="graph" style="width: 100%; height: 600px;"></div>
        </div>
      `,
      this.container,
    );

    const graphEl = this.container.querySelector('#graph');
    if (!graphEl || !graph) return;

    set(this.renderGraph$, graph, graphEl as HTMLDivElement, signal);
  });

  private renderGraph$ = command((_, graph: DAGGraph, element: HTMLDivElement, signal: AbortSignal) => {
    const cy = cytoscape({
      layout: {
        name: 'dagre',
      },

      container: element,
      elements: {
        nodes: Array.from(graph.nodes.entries()).map(([id, node]) => ({
          data: {
            id: id.toString(),
            label: node.label,
            ...node.data,
          },
          classes: [node.shape],
        })),
        edges: graph.edges.map(([from, to, value]) => ({
          data: {
            id: `${from.toString()}-${to.toString()}`,
            source: from.toString(),
            target: to.toString(),
            label: String(value),
          },
        })),
      },
    });

    signal.addEventListener('abort', () => {
      cy.destroy();
    });
  });
}

customElements.define('ccstate-devtools', CCStateDevtools);

declare global {
  interface HTMLElementTagNameMap {
    'ccstate-devtools': CCStateDevtools;
  }
}
