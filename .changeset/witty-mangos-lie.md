---
'ccstate': major
---

Remove the computed callback's second argument, including `options.signal`, so computed evaluation only reads dependencies and caches its returned value. Returned Promises are ordinary values and are not automatically cancelled when dependencies change.

Update callbacks from `computed((get, { signal }) => ...)` to `computed((get) => ...)`. If an operation needs cancellation, move its lifecycle management into a command and pass an explicitly owned `AbortSignal`. The signal supplied to a `watch` callback remains supported for that invocation's external side effects.

Also fix cached error/value transitions, preserve `null` and `undefined` state updates, and deduplicate all three passes of mounted dependency propagation.
