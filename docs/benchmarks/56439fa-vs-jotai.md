# Fixed-SHA comprehensive benchmark: 56439fa vs Jotai

## Versions and status

- ccstate PR #223 runtime: `56439fae015bd0c01433ded2418c6456183f72ee`.
- Jotai 3.0.1: `6abd0ae3365e02ab432fba4b6e8e6f00aafbf508`.
- React/ReactDOM 19.0.0, Happy DOM 15.11.7.
- Production Node v24.21.0 / V8 13.6.233.17-node.53; shared Linux x64 Xeon 2.10GHz, two vCPU. No CPU affinity/exclusivity guarantee.

This document adds evidence only. Later documentation commits do not change the measured runtime SHA. The branch remains Draft. Legacy core-call/test and benchmark migrations are now complete, with normal local build/lint/test/CI-benchmark commands passing; exact-head remote CI and remaining documentation/independent review are separate gates. Later adapter migrations and the retained-unsubscribe reference-release fix are not part of this measured runtime and have not been assigned these timings.

## Coverage and correctness

94 parameterized scenarios:

- 72 synchronous Core: all 37 official Jotai benchmark parameters, ten retained-store corrections, five shared-root/command scenes, twenty steady/cache/conditional-dependency scenes.
- Eight async Core: depths 1/5, reads before/after suspension, subscribed/unsubscribed; each operation runs 100 update/await steps.
- Fourteen production React CSR: shared State, shared Computed, independent State, 100/1000 components, mount/unmount, updates and command batches.

202 independent correctness combinations pass. All 210 final React measurement processes have the expected aggregate Counter render counts; lifecycle runs also have the expected effect mount/unmount counts. Stronger independent React correctness checks also verify all components' final DOM values. The original timed-process records are not retroactively described as having those stronger DOM checks.

Captured Core and React library bundles were rebuilt from the pinned commits and confirmed byte-identical before finalization.

## Timing method

One worker at a time; rotate library order. Same esbuild 0.28.2 source-bundle settings, ESM/node24, no minification, production. React/ReactDOM are shared external dependencies.

Five fresh processes per version/scenario, seven samples per process. Report the median of process sample medians. Core samples run at least 60ms. Final React measurements use at least 1500ms warmup and seven at-least-200ms samples. Natural GC is retained; GC is forced once after fixture setup. Final data contains 1010 independent processes and 7070 samples.

React's initial short-warmup exploratory results are excluded from final tables. Some small React scenes still have large process-to-process variance, so ranges are reported and not treated as confidence intervals or strong rankings.

## Core result

Using a descriptive 10% threshold, not a statistical significance test:

- 35 of 37 official cases have ccstate median time at least 10% lower.
- Jotai leads in primitive and derived atom creation.
- Across all 72 synchronous cases: 68 ccstate leads, two Jotai leads, two within the threshold.
- All eight async cases are faster for ccstate in this run, approximately 1.26–2.27 times by inverse elapsed time. Independent counters confirm the same 100/500 business read executions and 100 subscribed / zero unsubscribed notifications per 100-step operation.

| Scene                                                   |  ccstate |    Jotai |
| ------------------------------------------------------- | -------: | -------: |
| Create 10k primitives                                   | 0.223 ms | 0.196 ms |
| Create 10k derived atoms                                | 0.291 ms | 0.175 ms |
| 10k mounted primitive writes                            | 1.638 ms | 5.510 ms |
| 10k mounted primitive reads                             | 0.170 ms | 0.474 ms |
| 1000 commands, each three writes, no intermediate reads | 2.004 ms | 2.760 ms |
| Same commands with eager intermediate reads             | 4.436 ms | 5.655 ms |

These are complete benchmark operations, not single get/set calls. Command scenes use 1000 separate commands, not one command containing all writes.

## React result: not a universal improvement

The matching subscription-mechanism comparison is ccstate `useGet` vs Jotai `useAtomValueRawSync` (both use `useSyncExternalStore`). Default Jotai `useAtomValue` uses a different reducer/effect path and is reported separately as the actual default API.

Below, one operation performs **20 updates** with 1000 components:

| Scene                                             | ccstate useGet | Jotai rawSync | Jotai default |
| ------------------------------------------------- | -------------: | ------------: | ------------: |
| Shared State                                      |       53.20 ms |      55.55 ms |      46.20 ms |
| Shared Computed                                   |       58.50 ms |      56.91 ms |      46.41 ms |
| Independent State, update only the last component |       2.267 ms |      2.448 ms |      2.087 ms |

For the two shared scenes, ccstate is within approximately 3–4% of rawSync. Jotai default takes approximately 13% / 21% less time than ccstate. This means the Core advantage does not translate into universal React leadership.

React uses real production ReactDOM, flushSync and MutationObserver-driven DOM readiness, not act or sleeps. Happy DOM does not measure browser layout, paint, GPU or input-to-paint. Async loadable/resolved APIs are not forced into an invalid ranking against Jotai v3 Suspense. Provider and hook-internal work are part of library overhead; matching Counter render counts does not imply identical internal scheduling.

## Why this PR can improve performance

1. **Direct listener subscription:** listeners attach to an existing readable signal. Each observer no longer allocates/evaluates a hidden watcher computed.
2. **State subscription without wrappers:** a primitive State can be observed directly instead of paying for an artificial computed node.
3. **Cancellation resources moved out of simple subscription:** unsubscribe removes the listener directly. Hook Promise-result isolation is handled by a subscription lease/generation; a simple observer does not allocate an AbortController.
4. **Changed-target queue:** propagation records changed subscription targets. Flush collects a local callback Set, deduplicates and iterates it rather than copying callbacks during graph traversal and then making an array snapshot.
5. **Synchronous command batching:** intermediate writes invalidate rather than fully recompute/notify. Without eager reads, three writes compute/notify once; eager get still returns current intermediate values, but final notification is coalesced.
6. **Reusable cleared store work:** invalidation flags, epoch snapshots and source sets are store-owned scratch work, avoiding repeated collection allocation. Evaluation dependency Maps and AbortSignal owners remain distinct; they are not reused.

The subscription and notification contract changes are intentional breaking changes, not universally semantics-preserving micro-optimizations. Initial rendering/effects and invocation-specific effect cancellation must be handled explicitly by callers or adapters.

## Boundaries and data

Original upstream store-size cases do not retain atom references and set the initial value. They are reproduced but cannot reliably represent live-store size. Ten corrected cases retain references and perform real writes. `subscribe-write` updates an unobserved target independent of other subscriptions. Upstream chain/diamond/fan-out/churn scenes include lifecycle work; supplemental steady scenes isolate propagation/cache work.

Some unobserved-write bookkeeping is more expensive than the prior prototype; those results remain in the broader evidence. There is no blended Core/React total score, universal performance claim, full legacy-suite claim or browser/end-user acceptance claim.

All 94 final scenario medians are included in [the summary CSV](56439fa-vs-jotai-summary.csv). Its fields are nanoseconds per complete operation; React `jotai_raw_sync_ns` and `jotai_standard_ns` are intentionally separate columns. Raw samples, per-process ranges, exploratory warmup results, integrity manifests and runnable captured libraries were delivered to the requesting user as a reproduction archive.

Sources:

- https://github.com/pmndrs/jotai/tree/6abd0ae3365e02ab432fba4b6e8e6f00aafbf508/benchmarks
- [Migration and contract details](../readable-watch-migration.md)
