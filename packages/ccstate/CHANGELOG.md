# ccstate

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
