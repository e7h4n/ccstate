---
'ccstate': minor
'ccstate-react': minor
'ccstate-solid': minor
'ccstate-svelte': minor
'ccstate-vue': minor
---

Build ESM output for modern browsers (Chrome/Edge 111, Firefox 114, Safari 16.4) instead of the default `@babel/preset-env` targets. The CJS output keeps the previous legacy transforms.

`@babel/preset-env` was running without a `targets` option, so the published ESM bundles carried `@babel/plugin-transform-classes` and `@babel/plugin-transform-spread` helpers that no ESM-capable browser needs. Bundlers that consume the ESM entry now get smaller output, and Lighthouse no longer reports these as legacy JavaScript.
