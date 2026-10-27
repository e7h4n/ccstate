---
'ccstate': minor
---

Mark `state`, `computed`, and `command` with `/* @__NO_SIDE_EFFECTS__ */` so bundlers that honor the annotation, such as Rolldown and Rollup, can tree-shake unused signal declarations and everything they reference. esbuild only applies this annotation within the declaring file, so esbuild users still need `/* @__PURE__ */` at call sites.
