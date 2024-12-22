// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { afterEach, it } from 'vitest';
import { computed, command, state, createStore, type Updater, type State } from 'ccstate';
import { useGet } from '../useGet';
import { useSet } from '../useSet';
import { StoreProvider } from '../provider';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});

it('remove an item, then add another', async () => {
  interface Item {
    text: string;
    checked: boolean;
  }
  let itemIndex = 0;
  const itemsAtom = state<State<Item>[]>([]);

  const ListItem = ({ itemAtom, remove }: { itemAtom: State<Item>; remove: () => void }) => {
    const item = useGet(itemAtom);
    const setItem = useSet(itemAtom);

    const toggle = () => {
      setItem((prev) => {
        return { ...prev, checked: !prev.checked };
      });
    };

    return (
      <>
        <div>
          {item().text} checked: {item().checked ? 'yes' : 'no'}
        </div>
        <button onClick={toggle}>Check {item().text}</button>
        <button onClick={remove}>Remove {item().text}</button>
      </>
    );
  };

  const List = () => {
    const items = useGet(itemsAtom);
    const setItems = useSet(itemsAtom);

    const addItem = () => {
      setItems((prev) => {
        return [
          ...prev,
          state({
            text: `item${String(++itemIndex)}`,
            checked: false,
          }),
        ];
      });
    };

    const removeItem = (itemAtom: State<Item>) => {
      setItems((prev) => {
        return prev.filter((x) => x !== itemAtom);
      });
    };

    return (
      <ul>
        {items().map((itemAtom) => (
          <ListItem
            itemAtom={itemAtom}
            remove={() => {
              removeItem(itemAtom);
            }}
          />
        ))}
        <li>
          <button onClick={addItem}>Add</button>
        </li>
      </ul>
    );
  };

  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <List />
    </StoreProvider>
  ));

  await userEvent.click(screen.getByText('Add'));
  await screen.findByText('item1 checked: no');

  await userEvent.click(screen.getByText('Add'));
  await waitFor(() => {
    screen.getByText('item1 checked: no');
    screen.getByText('item2 checked: no');
  });

  await userEvent.click(screen.getByText('Check item2'));
  await waitFor(() => {
    screen.getByText('item1 checked: no');
    screen.getByText('item2 checked: yes');
  });

  await userEvent.click(screen.getByText('Remove item1'));
  await screen.findByText('item2 checked: yes');

  await userEvent.click(screen.getByText('Add'));
  await waitFor(() => {
    screen.getByText('item2 checked: yes');
    screen.getByText('item3 checked: no');
  });
});

it('add an item with filtered list', async () => {
  interface Item {
    text: string;
    checked: boolean;
  }
  type ItemAtoms = State<Item>[];

  let itemIndex = 0;
  const itemAtomsAtom = state<ItemAtoms>([]);
  const setItemsAtom = command(({ set }, update: Updater<ItemAtoms>) => {
    set(itemAtomsAtom, update);
  });

  const filterAtom = state<'all' | 'checked' | 'not-checked'>('all');
  const filteredAtom = computed((get) => {
    const filter = get(filterAtom);
    const items = get(itemAtomsAtom);
    if (filter === 'all') {
      return items;
    }
    if (filter === 'checked') {
      return items.filter((atom) => get(atom).checked);
    }
    return items.filter((atom) => !get(atom).checked);
  });

  const ListItem = ({ itemAtom, remove }: { itemAtom: State<Item>; remove: () => void }) => {
    const item = useGet(itemAtom);
    const setItem = useSet(itemAtom);
    const toggle = () => {
      setItem((prev) => ({ ...prev, checked: !prev.checked }));
    };
    return (
      <>
        <div>
          {item().text} checked: {item().checked ? 'yes' : 'no'}
        </div>
        <button onClick={toggle}>Check {item().text}</button>
        <button onClick={remove}>Remove {item().text}</button>
      </>
    );
  };

  const Filter = () => {
    const filter = useGet(filterAtom);
    const setFilter = useSet(filterAtom);

    return (
      <>
        <div>{filter()}</div>
        <button
          onClick={() => {
            setFilter('all');
          }}
        >
          All
        </button>
        <button
          onClick={() => {
            setFilter('checked');
          }}
        >
          Checked
        </button>
        <button
          onClick={() => {
            setFilter('not-checked');
          }}
        >
          Not Checked
        </button>
      </>
    );
  };

  const FilteredList = ({ removeItem }: { removeItem: (itemAtom: State<Item>) => void }) => {
    const items = useGet(filteredAtom);
    return (
      <ul>
        {items().map((itemAtom) => (
          <ListItem
            itemAtom={itemAtom}
            remove={() => {
              removeItem(itemAtom);
            }}
          />
        ))}
      </ul>
    );
  };

  const List = () => {
    const setItems = useSet(setItemsAtom);
    const addItem = () => {
      setItems((prev) => [...prev, state<Item>({ text: `item${String(++itemIndex)}`, checked: false })]);
    };
    const removeItem = (itemAtom: State<Item>) => {
      setItems((prev) => prev.filter((x) => x !== itemAtom));
    };
    return (
      <>
        <Filter />
        <button onClick={addItem}>Add</button>
        <FilteredList removeItem={removeItem} />
      </>
    );
  };

  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <List />
    </StoreProvider>
  ));

  await userEvent.click(screen.getByText('Checked'));
  await userEvent.click(screen.getByText('Add'));
  await userEvent.click(screen.getByText('All'));
  await screen.findByText('item1 checked: no');
});
