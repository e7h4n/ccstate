---
'ccstate-react': minor
---

Add `useLoadableSet` hook for tracking async command execution state. Returns a `[loadable, invoke]` tuple where `loadable` exposes `idle`/`loading`/`hasData`/`hasError` states and `invoke` triggers the command while automatically cancelling stale results.
