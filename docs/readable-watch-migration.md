# Readable watch and synchronous command batching

## Draft status

This branch is a core breaking-change prototype, not a release-ready migration. Existing callback-watch core tests, non-React framework adapters, examples, and public documentation are not yet fully migrated. The React hooks have now been migrated and their complete 68-case suite passes. The full CI pipeline is expected to remain blocked until those migrations are complete. No tests are skipped or deleted in the default pipeline to hide that boundary.

The isolated `tsconfig.prototype.json` and `vitest.prototype.workspace.json` exist only to validate the proposed runtime and dedicated tests. They do not replace the repository's normal lint/test configuration.

## New watch contract

```ts
const selected$ = computed((get) => get(source$));
const unsubscribe = store.watch(selected$, () => {
  render(store.get(selected$));
});

// Initial rendering is explicit, or provided by a framework snapshot API.
render(store.get(selected$));
unsubscribe();
```

`State` and `Computed` are both accepted directly. Commands are not readable subscription targets.

- Subscription mounts and reads the target to establish its dependency graph, but does not invoke the listener initially.
- The listener is attached to the target's mounted listener Set. There is no hidden computed per observer.
- Only a change in the target's value/error epoch notifies the listener.
- Listener reads do not add dependencies. Put all observed dependencies in an explicit computed.
- Multiple roots can share a listener; callback collection deduplicates it within one flush.
- Unsubscription is a returned function, rather than an external AbortController.
- The listener no longer receives an invocation AbortSignal. Effects requiring cancellation need their own owner.
- Computed's own per-evaluation AbortSignal and stale-async dependency isolation are preserved.
- Synchronous listener errors are collected as AggregateError while other listeners still execute.

A selector that always returns `undefined` generally does not produce later value changes. Do not move an old effect body unchanged into computed; return the actual selected value and run effects in the listener.

## Command write contract

Internal synchronous setters update state and mark dependents invalid without notifying after every write. Public write boundaries recompute pending work and flush callbacks using Jotai-style changed-signal bookkeeping. Eager reads remain fresh.

```ts
const doubled$ = computed((get) => get(count$) * 2);
store.watch(doubled$, () => console.log(store.get(doubled$)));

store.set(
  command(({ get, set }) => {
    set(count$, 1);
    get(doubled$); // 2, without listener notification
    set(count$, 2);
    get(doubled$); // 4, without listener notification
    set(count$, 3);
  }),
); // listener sees 6
```

Every command invocation owns its synchronous-lifetime flag. Returning a Promise or returning a setter ends that invocation's synchronous phase. A setter used after await or after escape flushes each write independently; this is not an asynchronous transaction spanning the whole Promise.

Nested internal command setters share pending work. A nested public `store.set` is a distinct checkpoint, and subscription/unsubscription can also flush outstanding work. This distinction is covered by the differential tests; do not replace it with a single global depth counter.

Store-owned scratch collections are cleared and reused, but evaluation dependency Maps and signal owners are not reused. Pending graph work is drained before listeners, including writes triggered synchronously by an old computed signal's abort handler.

## React migration — implemented and tested in this draft

`useGet` and the loadable subscription layer now use direct readable-signal subscriptions. The complete React suite passes: 63 existing cases (one hidden-computed-count assertion migrated to actual mount/unmount assertions) plus 5 new regression cases. React package TypeScript, modified-file lint/format, and React ESM/CJS/declaration builds are verified before handoff.

### useGet

Keep the existing `getSnapshot`, equality cache, store/atom dependencies, and `useSyncExternalStore`. Replace the adapter-owned AbortController and callback-computation watch with direct subscription:

```ts
const subscribe = useCallback((notify: () => void) => store.watch(atom, notify), [store, atom]);
return useSyncExternalStore(subscribe, getSnapshot);
```

React reads the initial snapshot and checks snapshot freshness after subscription. It does not require watch to issue an initial notification. State inputs need no computed wrapper.

### useLoadable / useLastLoadable / useLoadableState

The current implementation relies on watch's initial invocation and per-invocation signal. Merely changing the watch signature would lose initialization and stale-Promise protection.

The replacement subscription owns a per-subscription active flag and a per-observed-value generation:

1. Register a listener on the supplied readable signal.
2. Explicitly refresh from `store.get` to handle the current value/Promise.
3. On each refresh, advance the generation and attach resolve/reject handlers.
4. Apply a handler result only if the subscription is still active and its generation is still current.
5. Cleanup deactivates that subscription, invalidates its generation, and calls unsubscribe.

This isolates late results; it must not cancel a shared computed task when one component unsubscribes. Computed's own signal remains the task cancellation mechanism.

Preserve `keepLastResolved`, data equality, selected-result identity, loading/error transitions and suppression of redundant notifications. A new StrictMode subscription must have a new lease; a global active boolean alone is insufficient. Synchronous `store.get` failures now become `hasError` loadable results and can recover when the computed becomes readable again; a regression test covers both directions instead of letting errors escape through listener aggregation.

### useResolved / useLastResolved

These are selectors over the loadable hooks and inherit their migration. Verify sync values, Promise resolution, previous-value preservation, equality and atom changes.

### useSet / useLoadableSet

`useSet` need not change its callback identity or forwarding contract; the core owns batching. `useLoadableSet` does not use store.watch. Keep its command-result race/unmount isolation initially; do not delete those controllers as if they were subscription controllers.

### Required React acceptance tests

- StrictMode subscribe/unsubscribe/resubscribe and no late updates after cleanup.
- Changing State or Computed arguments, store changes, and resubscribing to the new target.
- A write between render and subscribe must not be missed.
- Multiple components observing one root both update and release correctly.
- Equality and Profiler commit counts remain correct.
- Resolve/reject of obsolete Promises cannot replace current results.
- Same Promise reused across rerenders or target changes does not loop or lose reactivity.
- Batch command notifications do not create stale UI snapshots.
- Existing hook tests remain the baseline; add deterministic deferred-Promise tests for new boundaries rather than weakening assertions.

## Verification completed

- 18 new watch-contract tests, 17 batching tests, and 2 existing cache tests: 37 passing cases.
- 18 command-boundary scenarios produce the same observable results as pinned Jotai 3.0.1.
- 52 benchmark fixtures × 3 versions: 156 correctness combinations.
- Actual Rollup ESM and CJS each pass all 52 fixtures.
- Core runtime TypeScript, changed-range lint/format, and core/main/debug ESM/CJS/declaration builds pass.

These checks do not mean the unchanged legacy-watch tests or the framework/UI suite pass.

## Performance evidence

Five independent processes per version/scenario; production Node 24; same host and source-bundle settings. One timed command-batch operation contains 1000 commands, each with three writes.

| Scenario                                | Previous readable-watch prototype | This prototype | Jotai 3.0.1 |
| --------------------------------------- | --------------------------------: | -------------: | ----------: |
| Three-write commands, no eager reads    |                           6.12 ms |        2.02 ms |     2.76 ms |
| Three-write commands with eager reads   |                           5.95 ms |        4.39 ms |     6.08 ms |
| Primitive, 10k independent writes       |                           2.15 ms |        1.67 ms |     5.64 ms |
| Computed, 10k independent writes        |                          20.16 ms |       14.99 ms |    20.84 ms |
| Shared root, 1000 listeners, one update |                          27.78 µs |       25.52 µs |    26.43 µs |

Not every case improves. The unobserved target write with unrelated subscriptions rises from about 96 ns to 172 ns; the retained-million-state unobserved target write rises from 162 ns to 193 ns. These bookkeeping costs are recorded rather than hidden. Shared-host microbenchmarks are not browser or React end-user performance acceptance.

## References

- Jotai current internals: https://github.com/pmndrs/jotai/blob/6abd0ae3365e02ab432fba4b6e8e6f00aafbf508/src/vanilla/internals.ts
- https://github.com/pmndrs/jotai/pull/2950 — transactionless write scheduling and already-invalidated short circuit
- https://github.com/pmndrs/jotai/pull/3284 — avoiding empty/redundant graph work
- https://github.com/pmndrs/jotai/pull/2960 and https://github.com/pmndrs/jotai/pull/2965 — eager read correctness
- https://github.com/pmndrs/jotai/pull/2907 — equal-result branch and join correctness
- https://github.com/pmndrs/jotai/pull/3354 — nested no-op/subscription cascade

## Before marking ready

- Migrate old watch call sites and tests without removing distinct correctness boundaries.
- React hooks are migrated and the complete React suite passes. Migrate the other framework adapters and run their behavioral tests.
- Update examples, README and vanilla/framework docs.
- Restore full normal build/lint/test/benchmark CI to green without exclusion configs.
- Independently review lifecycle, error, subscription and write-boundary semantics.
- Keep this Draft and unmerged until those gates are satisfied.
