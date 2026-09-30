---
'ccstate': minor
---

Fix cached error/value transitions, preserve `null` and `undefined` state updates, and deduplicate all three passes of mounted dependency propagation.

Keep the computed callback's `{ signal }` argument and make it stable within each evaluation. Reevaluation aborts the previous signal even when the new callback does not read its signal. Late signal access from an obsolete evaluation cannot cancel a newer evaluation. Watch callbacks continue to use computed signals. Returned Promises remain unchanged, without Promise cancellation bookkeeping or wrappers.
