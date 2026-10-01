# Legacy test and benchmark migration ledger

## Scope

This follow-up migrates the legacy callback-watch tests and repository benchmark callers to the new readable subscription contract. It does not reintroduce a callback-watch compatibility layer or change the selected dependency-graph algorithm. Existing test declarations remain; one retained-cleanup GC regression is added.

Normal repository validation is used, not the isolated prototype workspace/runtime configs:

```sh
pnpm build
pnpm lint
pnpm test
CI=true pnpm bench
```

Local verification used pnpm 10.15.0 (the CI version), a frozen-lockfile installation inside this worktree, and no lockfile/dependency changes. This avoids dependency symlinks outside the worktree that interfered with Solid's web-mode test loader.

## Contract changes and preserved boundaries

| Area                           | Old assumption                                                         | Migration / preserved checks                                                                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initialization                 | Callback-watch executes the effect on registration                     | Read the current value explicitly and assert no initial change callback. Change notifications remain observable and asserted.                                                                           |
| Single readable target         | A callback receives get and discovers dependencies                     | Subscribe directly to State/Computed. Multi-source selection uses an explicit computed returning an actual selected value.                                                                              |
| Command notification counts    | Every internal synchronous set immediately notifies                    | Assert final batched values; explicit intermediate get stays fresh; post-await setters still notify independently.                                                                                      |
| Subscription cancellation      | Caller-owned AbortController cancels watcher and its invocation signal | Use unsubscribe for subscription lifetime. Tasks that need cancellation retain an explicit task owner; computed signal tests remain per-evaluation and verify old/current signal identity and abortion. |
| Shared computation ownership   | Removing an observer also owns/cancels its computation                 | Assert unsubscription stops notification without taking ownership of a shared computed signal; reevaluation still cancels the previous computed signal.                                                 |
| Mount/interceptor/debug shape  | Every observer adds a hidden computed node                             | Assert actual target/dependency mount/unmount events and cached read behavior without counting a nonexistent hidden node.                                                                               |
| Equality and graph propagation | Values, errors, conditional edges, joins and cutoff                    | Preserve distinct/epoch, unequal-path diamond, conditional dependency, error transition and redundant-computation assertions.                                                                           |
| Async and promises             | Old evaluations can finish, but cannot replace current ownership       | Preserve Promise identity, stale-read isolation, late signal access, rejection handling and async dependency tests.                                                                                     |
| Memory                         | Disposed graph must be collectible                                     | Keep leak detector assertions; release retained unsubscribe captures rather than weaken GC checks.                                                                                                      |
| Benchmark setup                | Subscription adapter invokes old watch and counts its initialization   | Direct readable subscription with returned cleanup; current values verified separately; actual change callback values/counts asserted.                                                                  |

The migrated test names distinguish subscriptions, observed computed evaluations and explicit effect ownership rather than claiming that the removed watcher signal API still exists.

## Real lifecycle defect fixed

An owner can retain a disposed unsubscribe function. The previous closure continued capturing the target, listener and context, which kept an otherwise unmounted graph/payload alive.

The cleanup now captures a nullable subscription record. On its first call it detaches that record, removes the listener, unmounts unused dependencies and flushes pending work. Later calls are no-ops. Once disposed, retaining the cleanup no longer retains the target/listener payload.

The new case `a retained disposed unsubscribe releases both its target and captured listener payload` keeps the disposed function alive, calls it twice and checks collection with the existing leak detector. A temporary negative control omitted the record release and failed with `isLeaking() === true`; the correct source was restored before final verification.

## Declaration audit

An AST declaration audit compared each modified existing test file with the branch base. No file lost an it/test declaration. Parameterized tests retain their tables and behavior boundaries. The memory test file gains one declaration (8 to 9). No `.skip`/`.todo` was introduced to hide migration failures; focused negative-control filtering is not a change to the default test suite.

## Final local validation

- Normal full repository build: pass.
- Normal full repository lint (types, ESLint and format): pass.
- Normal full test/coverage command: **45 files, 382 cases pass**.
- Normal repository CI benchmark command: pass.
- Coverage snapshot: statements/lines **99.64%**, branches **99.23%**, functions **100%**. This is not reported as 100% coverage.

The full test run includes core/debug, benchmark correctness, React, Vue, Solid, Svelte and Babel. Normal benchmark execution is a smoke/benchmark gate, not a replacement for the separately recorded fixed-SHA Jotai comparison.

## Remaining handoff boundaries

The older comprehensive performance report measures runtime `56439fa`; this capture-release fix and test migration are later changes and have not been relabeled with those timings. The pure publication/example documentation migration and independent architecture review remain separate gates. Passing local checks does not mean remote CI, merge or release has happened; the exact pushed head must be checked separately.
