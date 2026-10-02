# ccstate

## 6.0.0

### Major Changes

- 40b9575: Disposed unsubscribe functions release captured signal/listener references, so retaining a completed cleanup does not keep an unmounted graph alive.

  Replace callback-computation watch with a readable-signal listener subscription: `store.watch(stateOrComputed, listener)` returns an unsubscribe function and does not invoke the listener initially. Listener reads do not collect dependencies, and listener-specific AbortSignal options are removed; computed-owned AbortSignal behavior remains.

  Batch synchronous internal command writes at the public write boundary. Explicit intermediate reads remain fresh, while listeners receive the flushed result. Post-await or escaped setters flush independently.

  Migrate Vue, Solid, and Svelte readable adapters to direct subscriptions and returned unsubscribe functions, preserving each framework's initial value and cleanup contracts.

  Migrate React hooks to direct readable subscriptions. Loadable hooks own their subscription lease and Promise generation so obsolete settlements cannot update current results; synchronous computed read failures become recoverable loadable error states.

## 5.7.0

### Minor Changes

- 412fcec: Fix cached error/value transitions, preserve `null` and `undefined` state updates, and deduplicate all three passes of mounted dependency propagation.

  Keep the computed callback's `{ signal }` argument and make it stable within each evaluation. Reevaluation aborts the previous signal even when the new callback does not read its signal. Late signal access from an obsolete evaluation cannot cancel a newer evaluation. Watch callbacks continue to use computed signals. Returned Promises remain unchanged, without Promise cancellation bookkeeping or wrappers.

## 5.6.0

### Minor Changes

- b535aa0: Cache dependency validation for unmounted computed values between state writes, avoiding repeated traversal of shared dependency graphs.

## 5.5.0

### Minor Changes

- 7283409: Build ESM output for modern browsers (Chrome/Edge 111, Firefox 114, Safari 16.4) instead of the default `@babel/preset-env` targets. The CJS output keeps the previous legacy transforms.

  `@babel/preset-env` was running without a `targets` option, so the published ESM bundles carried `@babel/plugin-transform-classes` and `@babel/plugin-transform-spread` helpers that no ESM-capable browser needs. Bundlers that consume the ESM entry now get smaller output, and Lighthouse no longer reports these as legacy JavaScript.

## 5.4.0

## 5.3.1

## 5.3.0

## 5.2.4

## 5.3.0

### Minor Changes

- ca7a146: Fix the previous publishing failure error.

## 5.2.0

### Minor Changes

- 304895d: Trigger a new release to resolve the previous unsuccessful deployment.

## 5.1.0

## 5.0.0

### Major Changes

- 2fdba09: feat: provide watch method to replace sub

### Minor Changes

- 52c52fd: refactor: remove defaultStore

## 4.13.0

## 4.12.0

## 4.11.0

## 4.10.0

## 4.9.0

### Minor Changes

- 89440c6: fix: capture exception in computed process

## 4.8.0

## 4.7.0

## 4.6.0

### Minor Changes

- 6f9e2ad: fix: useless recomputed when diamond deps

## 4.5.0

### Minor Changes

- 9d65ed7: fix: distinct computed evaluation

## 4.4.0

## 4.3.0

### Minor Changes

- 89d98a2: feat(ccstate): state & computed will distinct change by default

## 4.2.0

### Minor Changes

- 023d3a7: feat: set state & computed mutation will not distinct same value event

## 4.1.0

### Minor Changes

- 2ce0d1d: fix: glitch (#103)

## 4.0.0

### Major Changes

- b32ad0a: chore: bump version to align packages version

### Minor Changes

- 3e45895: feat: add default store

## 3.0.0

### Major Changes

- 932cb80: refactor: expose react hooks into independent package 'ccstate-react'
- 7035e82: refactor(debug): remove event & devtools

### Minor Changes

- d3b721c: feat: release vue support

## 2.2.0

### Minor Changes

- 8552718: feat(vue): support vue

## 2.1.0

### Minor Changes

- 846b50a: feat(debug): add createConsoleDebugStore

## 2.0.0

### Major Changes

- bc6bab1: refactor: rename rippling to CCState

## 1.11.0

### Minor Changes

- d8af4d5: feat(debug): add computed event
- d8af4d5: feat(debug): console interceptor support regex and string match atom debug label

## 1.10.0

### Minor Changes

- ccfd8fa: fix: crtical unmount bug

## 1.9.0

### Minor Changes

- efc7b09: fix: critical bug in dynamic deps track

## 1.8.0

### Minor Changes

- a9384e4: fix: critical bug affect unmount behavior

## 1.7.0

### Minor Changes

- ab6a6d6: feat(debug): add console interceptor to logging atom events to console

## 1.6.0

### Minor Changes

- d4427a1: chore: export last hooks

## 1.5.0

### Minor Changes

- 86b6c0f: feat: provide `useLastLoadable` & `useLastResolved` hook

## 1.4.0

### Minor Changes

- 8ee9acf: feat: ignore args & return value to devtools panel

## 1.3.0

### Minor Changes

- 06f94d0: fix: useGet not call unsub correctly

## 1.2.0

### Minor Changes

- ea4cb3f: feat: enhance debugging capabilities of debug store
- b4b7cd7: feat: add EventInterceptor to publish store events to subscriber

## 1.1.0

### Minor Changes

- 04c0473: feat: store support interceptor to monitor behavior
- 04c0473: fix: umount should release upstream atoms mounting state

## 1.0.0

### Major Changes

- e837a17: refactor: rename $effect to $func and change Write interface

### Minor Changes

- fa29c0f: feat: store.sub support AbortSignal

## 0.4.0

### Minor Changes

- bdf0f1f: feat: add toString for atoms
- 3b193d5: feat: expose Read & Write types

## 0.3.0

### Minor Changes

- 628b4ae: test changeset publish

## 0.2.0

### Minor Changes

- d9fa790: use monorepo to publish packages
