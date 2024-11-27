import LeakDetector from 'jest-leak-detector'
import { expect, it } from 'vitest'
import { state, State, Computed, computed, createStore, effect } from '..'


it('should release memory after delete state', async () => {
    const store = createStore()
    let base: State<object> | undefined = state({})

    const detector = new LeakDetector(store.get(base))
    base = undefined

    expect(await detector.isLeaking()).toBe(false)
})

it('should release memory after base state & derived computed is deleted', async () => {
    const store = createStore()
    let base: State<object> | undefined = state({})
    let derived: Computed<object> | undefined = computed((get) => ({
        obj: base && get(base),
    }))
    const detector1 = new LeakDetector(store.get(base))
    const detector2 = new LeakDetector(store.get(derived))

    base = undefined
    derived = undefined

    expect(await detector1.isLeaking()).toBe(false)
    expect(await detector2.isLeaking()).toBe(false)
})

it('with a long-lived base state', async () => {
    const store = createStore()
    const base = state({})

    let cmpt: Computed<object> | undefined = computed((get) => ({
        obj: get(base),
    }))

    const detector = new LeakDetector(store.get(cmpt))
    cmpt = undefined
    expect(await detector.isLeaking()).toBe(false)
})

it('should not hold onto dependent atoms that are not mounted', async () => {
    const store = createStore()
    const base = state({})
    let cmpt: Computed<unknown> | undefined = computed((get) => get(base))
    const detector = new LeakDetector(cmpt)
    store.get(cmpt)
    cmpt = undefined
    await expect(detector.isLeaking()).resolves.toBe(false)
})

it('unsubscribe on atom should release memory', async () => {
    const store = createStore()
    let objAtom: State<object> | undefined = state({})
    const detector = new LeakDetector(store.get(objAtom))
    let unsub: (() => void) | undefined = store.sub(objAtom, effect(() => {
        return;
    }))

    unsub()
    unsub = undefined
    objAtom = undefined
    expect(await detector.isLeaking()).toBe(false)
})

it('unsubscribe on computed should release memory', async () => {
    const store = createStore()
    let objAtom: State<object> | undefined = state({})
    const detector1 = new LeakDetector(store.get(objAtom))
    let derivedAtom: Computed<object> | undefined = computed((get) => ({
        obj: objAtom && get(objAtom),
    }))
    const detector2 = new LeakDetector(store.get(derivedAtom))
    let unsub: (() => void) | undefined = store.sub(objAtom, effect(() => {
        return;
    }))
    unsub()
    unsub = undefined
    objAtom = undefined
    derivedAtom = undefined
    expect(await detector1.isLeaking()).toBe(false)
    expect(await detector2.isLeaking()).toBe(false)
})

it('unsubscribe a long-lived base atom', async () => {
    const store = createStore()
    const base = state({})
    let cmpt: Computed<object> | undefined = computed((get) => ({
        obj: get(base),
    }))
    const detector = new LeakDetector(store.get(cmpt))
    let unsub: (() => void) | undefined = store.sub(base, effect(() => {
        return;
    }))
    unsub()
    unsub = undefined
    cmpt = undefined
    expect(await detector.isLeaking()).toBe(false)
})
