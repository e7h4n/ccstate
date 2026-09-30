# ccstate-svelte

## 5.7.0

### Patch Changes

- Updated dependencies [412fcec]
  - ccstate@5.7.0

## 5.6.0

### Patch Changes

- Updated dependencies [b535aa0]
  - ccstate@5.6.0

## 5.5.0

### Minor Changes

- 7283409: Build ESM output for modern browsers (Chrome/Edge 111, Firefox 114, Safari 16.4) instead of the default `@babel/preset-env` targets. The CJS output keeps the previous legacy transforms.

  `@babel/preset-env` was running without a `targets` option, so the published ESM bundles carried `@babel/plugin-transform-classes` and `@babel/plugin-transform-spread` helpers that no ESM-capable browser needs. Bundlers that consume the ESM entry now get smaller output, and Lighthouse no longer reports these as legacy JavaScript.

### Patch Changes

- Updated dependencies [7283409]
  - ccstate@5.5.0

## 5.4.0

### Patch Changes

- ccstate@5.4.0

## 5.3.1

### Patch Changes

- ccstate@5.3.1

## 5.3.0

### Patch Changes

- 47f1660: republish adapter packages with npm-compatible ccstate dependencies
  - ccstate@5.3.0

## 5.2.4

### Patch Changes

- ccstate@5.2.4

## 5.3.0

### Patch Changes

- Updated dependencies [ca7a146]
  - ccstate@5.3.0

## 5.2.0

### Patch Changes

- Updated dependencies [304895d]
  - ccstate@5.2.0

## 5.1.0

### Patch Changes

- ccstate@5.1.0

## 5.0.0

### Major Changes

- 2fdba09: feat: provide watch method to replace sub

### Minor Changes

- 52c52fd: refactor: remove defaultStore

### Patch Changes

- Updated dependencies [2fdba09]
- Updated dependencies [52c52fd]
  - ccstate@5.0.0

## 4.13.0

### Patch Changes

- ccstate@4.13.0

## 4.12.0

### Patch Changes

- ccstate@4.12.0

## 4.11.0

### Patch Changes

- ccstate@4.11.0

## 4.10.0

### Patch Changes

- ccstate@4.10.0

## 4.9.0

### Patch Changes

- Updated dependencies [89440c6]
  - ccstate@4.9.0

## 4.8.0

### Patch Changes

- ccstate@4.8.0

## 4.7.0

### Patch Changes

- ccstate@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [6f9e2ad]
  - ccstate@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [9d65ed7]
  - ccstate@4.5.0

## 4.4.0

### Patch Changes

- ccstate@4.4.0

## 4.3.0

### Patch Changes

- Updated dependencies [89d98a2]
  - ccstate@4.3.0

## 4.2.0

### Patch Changes

- Updated dependencies [023d3a7]
  - ccstate@4.2.0

## 4.1.0

### Patch Changes

- Updated dependencies [2ce0d1d]
  - ccstate@4.1.0

## 4.0.0

### Patch Changes

- Updated dependencies [b32ad0a]
- Updated dependencies [3e45895]
  - ccstate@4.0.0

## 3.0.0
