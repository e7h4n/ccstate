import { beforeEach, expect, it, vi, type Mock, afterEach, describe } from 'vitest';
import { setupDevtoolsMessageListener } from '../forwarder';
import { delay } from 'signal-timers';
import { $value, createDebugStore, setupDevtoolsInterceptor } from 'rippling';

describe('forwarder', () => {
  let controller: AbortController;
  let trace: Mock;
  let port: chrome.runtime.Port;
  let connect: () => void;
  beforeEach(() => {
    controller = new AbortController();
    trace = vi.fn();
    port = {
      postMessage: trace,
    } as unknown as chrome.runtime.Port;

    let _listener: ((port: chrome.runtime.Port) => void) | undefined;
    vi.spyOn(chrome.runtime.onConnect, 'addListener').mockImplementation((listener) => {
      _listener = listener;
    });
    connect = () => {
      if (_listener && !controller.signal.aborted) {
        _listener(port);
      }
    };
    vi.spyOn(chrome.runtime.onConnect, 'removeListener').mockImplementation(vi.fn());

    setupDevtoolsMessageListener(window, controller.signal);
  });

  afterEach(() => {
    controller.abort();
  });

  it('will forward messages to port', async () => {
    connect();

    const store = createDebugStore(setupDevtoolsInterceptor(window));
    store.set($value(0), 1);

    await delay(0);
    expect(trace).toHaveBeenCalledWith({
      source: 'rippling-store-inspector',
      payload: {
        eventId: expect.any(Number) as number,
        data: {
          beginTime: expect.any(Number) as number,
          endTime: expect.any(Number) as number,
          state: 'hasData',
        },
        targetAtom: expect.any(String) as string,
        type: 'set',
      },
    });
  });

  it('will forward history messages before connect', async () => {
    const store = createDebugStore(setupDevtoolsInterceptor(window));

    store.set($value(0), 1);
    await delay(0);

    connect();

    await delay(0);

    expect(trace).toHaveBeenCalledWith({
      source: 'rippling-store-inspector',
      payload: {
        eventId: expect.any(Number) as number,
        data: {
          beginTime: expect.any(Number) as number,
          endTime: expect.any(Number) as number,
          state: 'hasData',
        },
        targetAtom: expect.any(String) as string,
        type: 'set',
      },
    });
  });

  it('will not forward messages after abort', async () => {
    connect();

    controller.abort();
    const store = createDebugStore(setupDevtoolsInterceptor(window));
    store.set($value(0), 1);

    await delay(0);
    expect(trace).not.toHaveBeenCalled();
  });

  it("will not forward message can't recognize", async () => {
    connect();

    window.postMessage('foo');
    window.postMessage(null);
    window.postMessage(undefined);
    window.postMessage(123);
    window.postMessage({});
    window.postMessage({ source: 'hello' });
    await delay(0);
    expect(trace).not.toHaveBeenCalled();
  });
});
