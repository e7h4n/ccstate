---
'ccstate': major
---

Replace callback-computation watch with a readable-signal listener subscription: `store.watch(stateOrComputed, listener)` returns an unsubscribe function and does not invoke the listener initially. Listener reads do not collect dependencies, and listener-specific AbortSignal options are removed; computed-owned AbortSignal behavior remains.

Batch synchronous internal command writes at the public write boundary. Explicit intermediate reads remain fresh, while listeners receive the flushed result. Post-await or escaped setters flush independently.
