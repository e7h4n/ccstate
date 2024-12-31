import { command, getDefaultStore, type Computed, type DebugStore } from 'ccstate';
import { styles } from './styles';
import { createDevtools } from './devtools';
import { createView } from './view';

class CCStateDevtools extends HTMLElement {
  private store = getDefaultStore();
  private devtools: ReturnType<typeof createDevtools>;
  private view: ReturnType<typeof createView>;
  private dialog: HTMLDialogElement;
  private renderController: AbortController = new AbortController();

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'devtools-dialog';

    const style = document.createElement('style');
    style.textContent = styles;

    root.appendChild(style);
    root.appendChild(this.dialog);

    this.devtools = createDevtools();
    this.view = createView(this.devtools, this.dialog);

    this.store.set(this.view.render$, this.renderController.signal);
    this.store.sub(
      [this.devtools.debugStore$, this.devtools.computedWatches$, this.devtools.graph$],
      command(({ set }) => {
        this.renderController.abort();
        this.renderController = new AbortController();
        set(this.view.render$, this.renderController.signal);
      }),
    );
  }

  addDependenciesGraph(computed$: Computed<unknown>) {
    this.store.set(this.devtools.pushComputedWatch$, { target: computed$ });
  }

  get debugStore(): DebugStore | null {
    return this.store.get(this.devtools.debugStore$);
  }

  set debugStore(store: DebugStore | null) {
    this.store.set(this.devtools.setDebugStore$, store);
  }
}

customElements.define('ccstate-devtools', CCStateDevtools);

declare global {
  interface HTMLElementTagNameMap {
    'ccstate-devtools': CCStateDevtools;
  }
}
