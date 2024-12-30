import { command, computed, getDefaultStore, type Computed, type DebugStore } from 'ccstate';
import { styles } from './styles';
import { html, render } from 'lit-html';
import { createDevtools, type DAGGraph } from './devtools';
import cytoscape from 'cytoscape';

class CCStateDevtools extends HTMLElement {
  private store = getDefaultStore();
  private signals: ReturnType<typeof createDevtools>;
  private renderController?: AbortController;
  private container: HTMLDivElement;
  private dialog: HTMLDivElement;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private cyInstance?: cytoscape.Core;
  private resizeObserver: ResizeObserver;
  private resizeTimeout?: number;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.dialog = document.createElement('div');
    this.dialog.className = 'devtools-dialog';
    this.container = document.createElement('div');
    this.container.className = 'dialog-content';

    const titleBar = document.createElement('div');
    titleBar.className = 'dialog-title';
    titleBar.textContent = 'CCState Devtools';

    titleBar.addEventListener('mousedown', this.handleDragStart.bind(this));
    document.addEventListener('mousemove', this.handleDragMove.bind(this));
    document.addEventListener('mouseup', this.handleDragEnd.bind(this));

    const style = document.createElement('style');
    style.textContent = styles;

    this.dialog.appendChild(titleBar);
    this.dialog.appendChild(this.container);
    root.appendChild(style);
    root.appendChild(this.dialog);

    this.signals = createDevtools();
    this.store.set(this.render$);
    this.store.sub([this.signals.debugStore$, this.signals.computedWatches$, this.signals.graph$], this.render$);

    this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
    this.resizeObserver.observe(this.dialog);

    const viewportWidth = document.documentElement.clientWidth;
    this.dialog.style.left = `${viewportWidth - 620}px`;
    this.dialog.style.right = '';
  }

  private handleDragStart(e: MouseEvent) {
    this.isDragging = true;
    const rect = this.dialog.getBoundingClientRect();
    this.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private handleDragMove(e: MouseEvent) {
    if (!this.isDragging) return;
    
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const dialogRect = this.dialog.getBoundingClientRect();
    
    let x = e.clientX - this.dragOffset.x;
    let y = e.clientY - this.dragOffset.y;
    
    x = Math.max(0, Math.min(x, viewportWidth - dialogRect.width));
    y = Math.max(0, Math.min(y, viewportHeight - dialogRect.height));
    
    this.dialog.style.left = `${x}px`;
    this.dialog.style.top = `${y}px`;
    this.dialog.style.right = '';
  }

  private handleDragEnd() {
    this.isDragging = false;
  }

  disconnectedCallback() {
    document.removeEventListener('mousemove', this.handleDragMove.bind(this));
    document.removeEventListener('mouseup', this.handleDragEnd.bind(this));
    this.resizeObserver.disconnect();
    if (this.cyInstance) {
      this.cyInstance.destroy();
      this.cyInstance = undefined;
    }
    if (this.resizeTimeout) {
      window.clearTimeout(this.resizeTimeout);
    }
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
        <div id="tabs" data-testid="tabs">${tabs}</div>
        <div id="graph" data-testid="graph"></div>
      `,
      this.container,
    );

    const graphEl = this.container.querySelector('#graph');
    if (!graphEl || !graph) return;

    const contentRect = this.container.getBoundingClientRect();
    const height = contentRect.height - 60;
    graphEl.style.height = `${height}px`;

    set(this.renderGraph$, graph, graphEl as HTMLDivElement, signal);
  });

  private handleResize() {
    if (this.cyInstance) {
      if (this.resizeTimeout) {
        window.clearTimeout(this.resizeTimeout);
      }

      const contentRect = this.container.getBoundingClientRect();
      const graphEl = this.container.querySelector('#graph');
      if (graphEl) {
        const height = contentRect.height - 60;
        (graphEl as HTMLElement).style.height = `${height}px`;

        const zoom = this.cyInstance.zoom();
        const pan = this.cyInstance.pan();
        this.cyInstance.resize();
        this.cyInstance.zoom(zoom);
        this.cyInstance.pan(pan);
      }

      this.resizeTimeout = window.setTimeout(() => {
        if (this.cyInstance) {
          const extent = this.cyInstance.extent();
          const viewportWidth = this.cyInstance.width();
          const viewportHeight = this.cyInstance.height();

          if (
            extent.x2 - extent.x1 > viewportWidth * 1.2 ||
            extent.y2 - extent.y1 > viewportHeight * 1.2 ||
            (extent.x2 - extent.x1) * 1.2 < viewportWidth ||
            (extent.y2 - extent.y1) * 1.2 < viewportHeight
          ) {
            this.cyInstance
              .layout({
                name: 'breadthfirst',
                animate: true,
                animationDuration: 300,
                fit: true,
                padding: 30,
              })
              .run();
          }
        }
      }, 300);
    }
  }

  private renderGraph$ = command((_, graph: DAGGraph, element: HTMLDivElement, signal: AbortSignal) => {
    this.cyInstance = cytoscape({
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '14px',
            width: 100,
            height: 100,
            'background-color': '#f5f5f5',
            'border-width': 2,
            'border-color': '#e0e0e0',
            'text-wrap': 'wrap',
          },
        },
        {
          selector: 'node.circle',
          style: {
            shape: 'ellipse',
            'background-color': '#e3f2fd',
            'border-color': '#90caf9',
          },
        },
        {
          selector: 'node.rectangle',
          style: {
            shape: 'rectangle',
            'background-color': '#f3e5f5',
            'border-color': '#ce93d8',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#9e9e9e',
            'target-arrow-color': '#9e9e9e',
            'target-arrow-shape': 'vee',
            'curve-style': 'bezier',
            'arrow-scale': 1.5,
          },
        },
      ],
      minZoom: 0.2,
      maxZoom: 3,
      wheelSensitivity: 0.2,
      panningEnabled: true,
      userPanningEnabled: true,
      zoomingEnabled: true,
      userZoomingEnabled: true,
      boxSelectionEnabled: false,
      selectionType: 'single',
      touchTapThreshold: 8,
      desktopTapThreshold: 4,
      autoungrabify: false,
      autolock: false,
      container: element,
      elements: {
        nodes: Array.from(graph.nodes.entries()).map(([id, node]) => {
          const labels =
            node.label.substring(0, node.label.indexOf(':')) + '\n' + node.label.substring(node.label.indexOf(':') + 1);
          return {
            data: {
              id: id.toString(),
              label: labels,
              ...node.data,
            },
            classes: [node.shape],
          };
        }),
        edges: graph.edges.map(([from, to]) => ({
          data: {
            id: `${from.toString()}-${to.toString()}`,
            source: from.toString(),
            target: to.toString(),
          },
        })),
      },
    });

    this.cyInstance.layout({ name: 'breadthfirst' }).run();

    signal.addEventListener('abort', () => {
      if (this.cyInstance) {
        this.cyInstance.destroy();
        this.cyInstance = undefined;
      }
    });
  });
}

customElements.define('ccstate-devtools', CCStateDevtools);

declare global {
  interface HTMLElementTagNameMap {
    'ccstate-devtools': CCStateDevtools;
  }
}
