import { render, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { $computed, createStore, $effect, $value } from "../../core";
import { StoreProvider, useGet, useSet } from "..";

describe("react", () => {
  afterEach(() => {
    cleanup();
  });

  it("using rippling in react", async () => {
    const store = createStore();
    const base = $value(0);

    const trace = vi.fn();
    function App() {
      trace();
      const ret = useGet(base);
      return <div>{ret}</div>;
    }

    render(
      <StoreProvider value={store}>
        <App />
      </StoreProvider>,
    );
    expect(trace).toHaveBeenCalledTimes(1);

    expect(screen.getByText("0")).toBeTruthy();
    store.set(base, 1);
    expect(screen.getByText("0")).toBeTruthy();
    await Promise.resolve();
    expect(trace).toHaveBeenCalledTimes(2);
    expect(screen.getByText("1")).toBeTruthy();
    await Promise.resolve();
    expect(trace).toHaveBeenCalledTimes(2);
  });

  it("computed should re-render", async () => {
    const store = createStore();
    const base = $value(0);
    const derived = $computed((get) => get(base) * 2);

    const trace = vi.fn();
    function App() {
      const ret = useGet(derived);
      trace();
      return <div>{ret}</div>;
    }

    render(
      <StoreProvider value={store}>
        <App />
      </StoreProvider>,
    );
    expect(trace).toHaveBeenCalledTimes(1);

    trace.mockClear();
    expect(screen.getByText("0")).toBeTruthy();
    store.set(base, 1);
    expect(trace).not.toBeCalled();

    await Promise.resolve();
    expect(trace).toBeCalledTimes(1);
    expect(screen.getByText("2")).toBeTruthy();

    trace.mockClear();
    store.set(base, 1);
    await Promise.resolve();
    expect(trace).not.toBeCalled();
  });

  it("user click counter should increment", async () => {
    const store = createStore();
    const count = $value(0);
    const onClickEffect = $effect((get, set) => {
      const ret = get(count);
      set(count, ret + 1);
    });

    const trace = vi.fn();
    function App() {
      trace();
      const ret = useGet(count);
      const onClick = useSet(onClickEffect);

      return <button onClick={onClick}>{ret}</button>;
    }

    render(
      <StoreProvider value={store}>
        <App />
      </StoreProvider>,
    );
    const button = screen.getByText("0");
    expect(button).toBeTruthy();

    const user = userEvent.setup();
    await user.click(button);
    expect(screen.getByText("1")).toBeTruthy();
    await user.click(button);
    expect(screen.getByText("2")).toBeTruthy();

    expect(trace).toHaveBeenCalledTimes(3);
  });

  it("two atom changes should re-render once", async () => {
    const store = createStore();
    const state1 = $value(0);
    const state2 = $value(0);
    const trace = vi.fn();
    function App() {
      trace();
      const ret1 = useGet(state1);
      const ret2 = useGet(state2);
      return <div>{ret1 + ret2}</div>;
    }

    render(
      <StoreProvider value={store}>
        <App />
      </StoreProvider>,
    );
    expect(screen.getByText("0")).toBeTruthy();
    expect(trace).toHaveBeenCalledTimes(1);

    store.set(state1, 1);
    store.set(state2, 2);
    await Promise.resolve();
    expect(trace).toHaveBeenCalledTimes(2);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("async callback will trigger rerender", async () => {
    const store = createStore();
    const count = $value(0);
    const onClickEffect = $effect((get, set) => {
      return Promise.resolve().then(() => {
        set(count, get(count) + 1);
      });
    });

    function App() {
      const val = useGet(count);
      const onClick = useSet(onClickEffect);
      return <button onClick={onClick}>{val}</button>;
    }

    render(
      <StoreProvider value={store}>
        <App />
      </StoreProvider>,
    );
    const button = screen.getByText("0");
    expect(button).toBeTruthy();

    const user = userEvent.setup();
    await user.click(button);
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("floating promise trigger rerender", async () => {
    const store = createStore();
    const count = $value(0);
    const onClickEffect = $effect((get, set) => {
      void Promise.resolve().then(() => {
        set(count, get(count) + 1);
      });
    });

    function App() {
      const val = useGet(count);
      const onClick = useSet(onClickEffect);
      return <button onClick={onClick}>{val}</button>;
    }

    render(
      <StoreProvider value={store}>
        <App />
      </StoreProvider>,
    );
    const button = screen.getByText("0");
    expect(button).toBeTruthy();

    const user = userEvent.setup();
    await user.click(button);
    expect(await screen.findByText("1")).toBeTruthy();
  });
});
