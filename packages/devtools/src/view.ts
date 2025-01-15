import { command, computed, state } from 'ccstate';
import type { createDevtools, DAGGraph } from './devtools';
import { html, render } from 'lit-html';
import cytoscape from 'cytoscape';

export function createView(devtools: ReturnType<typeof createDevtools>, el: HTMLDialogElement) {
  el.open = true;
  const el$ = state(el);

  const draggingCtrl$ = state(new AbortController());
  const resetDragging$ = command(({ set, get }) => {
    get(draggingCtrl$).abort();
    set(draggingCtrl$, new AbortController());
  });

  const renderSignal$ = state<AbortSignal | undefined>(undefined);

  const draggingSignal$ = computed((get) => {
    const rootSignal = get(renderSignal$);
    if (!rootSignal) {
      return get(draggingCtrl$).signal;
    }

    return AbortSignal.any([get(draggingCtrl$).signal, rootSignal]);
  });

  const bounding$ = computed((get) => {
    return get(el$).getBoundingClientRect();
  });

  const dragging$ = state<null | { x: number; y: number }>(null);

  const onMouseDown$ = command(({ get, set }, e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement) || !e.target.classList.contains('dialog-title')) {
      return;
    }

    set(resetDragging$);
    const rect = el.getBoundingClientRect();
    set(dragging$, { x: e.clientX - rect.left, y: e.clientY - rect.top });

    document.addEventListener(
      'mousemove',
      (e) => {
        set(onMouseMove$, e);
      },
      { signal: get(draggingSignal$) },
    );
    document.addEventListener(
      'mouseup',
      (e) => {
        set(onMouseUp$, e);
      },
      { signal: get(draggingSignal$) },
    );
  });

  const viewport$ = computed(() => {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    };
  });

  const onMouseMove$ = command(({ get }, e: MouseEvent) => {
    const dragState = get(dragging$);
    if (!dragState) {
      return;
    }

    const viewport = get(viewport$);
    const dialogRect = get(bounding$);

    let x = e.clientX - dragState.x;
    let y = e.clientY - dragState.y;

    x = Math.max(0, Math.min(x, viewport.width - dialogRect.width));
    y = Math.max(0, Math.min(y, viewport.height - dialogRect.height));

    get(el$).style.left = `${String(x)}px`;
    get(el$).style.top = `${String(y)}px`;
    get(el$).style.right = '';
  });

  const onMouseUp$ = command(({ get, set }) => {
    set(dragging$, null);
    get(draggingCtrl$).abort();
  });

  const tabs$ = computed((get) => {
    const computedWatches = get(devtools.computedWatches$);
    return computedWatches.map(
      (watch) => html`<button class="computed-select-button">${watch.target.toString()}</button>`,
    );
  });

  const render$ = command(({ get, set }, signal: AbortSignal) => {
    set(renderSignal$, signal);

    const debugStore = get(devtools.debugStore$);
    const tabs = get(tabs$);
    const graph = get(devtools.graph$);

    const viewport = get(viewport$);
    get(el$).style.left = `${String(viewport.width - 620)}px`;
    get(el$).style.top = `${String(viewport.height - 520)}px`;
    get(el$).style.right = 'auto';
    get(el$).style.bottom = 'auto';

    get(el$).addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        set(onMouseDown$, e);
      },
      { signal },
    );

    if (!debugStore) {
      render(
        html`
          <div class="dialog-title">CCState Devtools</div>
          <div class="dialog-content">
            <div data-testid="debug-store-not-set">Please set debugStore attribute First</div>
          </div>
        `,
        get(el$),
      );
      return;
    }

    render(
      html`
        <div class="dialog-title">CCState Devtools</div>
        <div class="dialog-content">
          <div id="tabs" data-testid="tabs">${tabs}</div>
          <div id="graph" data-testid="graph"></div>
        </div>
      `,
      get(el$),
    );

    const graphEl: HTMLDivElement | null = get(el$).querySelector('#graph');
    if (!graphEl || !graph) return;

    const contentRect = get(el$).getBoundingClientRect();
    const height = contentRect.height - 60;
    graphEl.style.height = `${String(height)}px`;

    set(renderGraph$, graph, graphEl, signal);
  });

  const cyInstance$ = state<cytoscape.Core | null>(null);
  const renderGraph$ = command(({ set }, graph: DAGGraph, element: HTMLDivElement, signal: AbortSignal) => {
    const cyInstance = cytoscape({
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
      layout: {
        name: 'breadthfirst',
      },
    });
    set(cyInstance$, cyInstance);

    signal.addEventListener('abort', () => {
      cyInstance.destroy();
      set(cyInstance$, (x) => (x === cyInstance ? null : x));
    });
  });

  return {
    render$,
  };
}
