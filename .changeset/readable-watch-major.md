---
'ccstate': major
---

Disposed unsubscribe functions release captured signal/listener references, so retaining a completed cleanup does not keep an unmounted graph alive.

Replace callback-computation watch with a readable-signal listener subscription: `store.watch(stateOrComputed, listener)` returns an unsubscribe function and does not invoke the listener initially. Listener reads do not collect dependencies, and listener-specific AbortSignal options are removed; computed-owned AbortSignal behavior remains.

Batch synchronous internal command writes at the public write boundary. Explicit intermediate reads remain fresh, while listeners receive the flushed result. Post-await or escaped setters flush independently.

Migrate Vue, Solid, and Svelte readable adapters to direct subscriptions and returned unsubscribe functions, preserving each framework's initial value and cleanup contracts.

Migrate React hooks to direct readable subscriptions. Loadable hooks own their subscription lease and Promise generation so obsolete settlements cannot update current results; synchronous computed read failures become recoverable loadable error states.
