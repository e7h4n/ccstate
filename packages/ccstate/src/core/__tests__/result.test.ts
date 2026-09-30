import { describe, expect, it, vi } from 'vitest';
import { computed, createStore, state } from '..';

describe.each([false, true])('computed results (mounted: %s)', (mounted) => {
  it.each([new Error('offline'), undefined, null, 0, false, ''])(
    'distinguishes a successful undefined from throwing %s and recovers',
    (error) => {
      const store = createStore();
      const broken$ = state(false);
      const output$ = computed<undefined>((get) => {
        if (get(broken$)) {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw error;
        }
        return undefined;
      });
      const caught$ = computed((get) => {
        try {
          get(output$);
          return { value: undefined };
        } catch (error) {
          return { error };
        }
      });
      const relay$ = computed((get) => get(caught$));
      const listener = vi.fn();
      if (mounted) {
        store.watch((get) => {
          listener(get(relay$));
        });
      }

      expect(store.get(relay$)).toEqual({ value: undefined });
      store.set(broken$, true);
      expect(store.get(relay$)).toEqual({ error });
      store.set(broken$, false);
      expect(() => {
        store.get(output$);
      }).not.toThrow();
      expect(store.get(relay$)).toEqual({ value: undefined });

      if (mounted) {
        expect(listener.mock.calls).toEqual([[{ value: undefined }], [{ error }], [{ value: undefined }]]);
      }
    },
  );

  it('replaces a cached error and propagates the new error through a derived catch', () => {
    const store = createStore();
    const first = new Error('first');
    const second = new Error('second');
    const reason$ = state(first);
    const output$ = computed((get) => {
      throw get(reason$);
    });
    const caught$ = computed((get) => {
      try {
        get(output$);
      } catch (error) {
        return error;
      }
      return undefined;
    });
    const relay$ = computed((get) => get(caught$));
    const listener = vi.fn();
    if (mounted) {
      store.watch((get) => {
        listener(get(relay$));
      });
    }

    expect(store.get(relay$)).toBe(first);
    expect(() => store.get(output$)).toThrow(first);
    store.set(reason$, second);
    expect(store.get(relay$)).toBe(second);
    expect(() => store.get(output$)).toThrow(second);
    if (mounted) {
      expect(listener.mock.calls).toEqual([[first], [second]]);
    }
  });

  it('keeps downstream results cached when a computed throws the same error again', () => {
    const store = createStore();
    const trigger$ = state(0);
    const error = new Error('unchanged');
    const output$ = computed((get) => {
      get(trigger$);
      throw error;
    });
    const catchError = vi.fn((get: Parameters<typeof output$.read>[0]) => {
      try {
        get(output$);
      } catch (error) {
        return error;
      }
      return undefined;
    });
    const caught$ = computed(catchError);
    if (mounted) {
      store.watch((get) => get(caught$));
    }

    expect(store.get(caught$)).toBe(error);
    store.set(trigger$, 1);
    expect(store.get(caught$)).toBe(error);
    expect(catchError).toHaveBeenCalledTimes(1);
  });
});
