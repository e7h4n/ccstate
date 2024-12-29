import { computed, createDebugStore, state, type Computed, type State } from 'ccstate';
import '../src';

function createDiamondDeps(
  n: number,
  shape: 'left' | 'right' | 'alternate' | 'random',
): [State<number>, (State<number> | Computed<number>)[], State<number> | Computed<number>] {
  if (n < 1) throw new Error('number of layers must be greater than 0');

  // create base state
  if (n === 1) {
    const base$ = state(0, {
      debugLabel: 'base$',
    });
    return [base$, [base$], base$];
  }

  if (n === 2) {
    const [base$] = createDiamondDeps(n - 1, shape);
    const current$ = computed(
      (get) => {
        return get(base$);
      },
      {
        debugLabel: 'computed:0$',
      },
    );
    return [base$, [base$, current$], current$];
  }

  if (n === 3) {
    const [base$, [, firstComputed$]] = createDiamondDeps(n - 1, shape);
    const top$ = computed(
      (get) => {
        return get(firstComputed$) + 1;
      },
      {
        debugLabel: `computed:1$`,
      },
    );
    return [base$, [base$, firstComputed$], top$];
  }

  const [base$, computes, top$] = createDiamondDeps(n - 1, shape);
  const baseComputed$ = computes[Math.floor(Math.random() * computes.length)];
  const currentComputed$ = computed((get) => get(baseComputed$), {
    debugLabel: `computed:${String(n - 2)}$`,
  });
  const currentLevelShape =
    shape === 'left' || (shape === 'alternate' && n % 7 === 0) || (shape === 'random' && Math.random() > 0.5)
      ? 'left'
      : 'right';
  const newTop$ = computed(
    (get) => {
      if (currentLevelShape === 'left') {
        if (get(top$) > get(currentComputed$)) {
          return get(top$);
        }
      } else {
        if (get(currentComputed$) <= get(top$)) {
          return get(top$);
        }
      }

      throw new Error('should never happen');
    },
    {
      debugLabel: `top:${String(n - 2)}:${currentLevelShape}$`,
    },
  );

  return [base$, [...computes, currentComputed$], newTop$];
}

const debugStore = createDebugStore();

const devtools = document.createElement('ccstate-devtools');
document.body.appendChild(devtools);
devtools.debugStore = debugStore;

const [, , top$] = createDiamondDeps(30, 'random');

debugStore.get(top$);
devtools.addDependenciesGraph(top$ as Computed<unknown>);

// const button = document.createElement('button');
// button.textContent = 'Toggle Branch';
// button.addEventListener('click', () => {
//   debugStore.set(branch$, (x) => !x);
// });
// document.body.appendChild(button);
