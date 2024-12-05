import { ReadableAtom, Effect, Getter, Computed, Value } from "../typing/atom";
const EMPTY_MAP = new Map<ReadableAtom<unknown>, number>();

export interface StateState<T> {
    mounted?: Mounted,
    val: T,
    epoch: number,
}

export interface ComputedState<T> {
    mounted?: Mounted,
    val: T,
    dependencies: Map<ReadableAtom<unknown>, number>,
    epoch: number,
    abortController?: AbortController
}

type CommonReadableState<T> = {
    [K in keyof StateState<T> & keyof ComputedState<T>]: StateState<T>[K]
}

type AtomState<T> = StateState<T> | ComputedState<T>

interface Mounted {
    listeners: Set<Effect<unknown, []>>,
    readDepcs?: Map<ReadableAtom<unknown>, number>,
    readDepts: Set<ReadableAtom<unknown>>,
}

function canReadAsCompute<T>(atom: ReadableAtom<T>): atom is Computed<T> {
    return 'read' in atom
}

export class AtomManager {
    private atomStateMap = new WeakMap<ReadableAtom<unknown>, AtomState<unknown>>()

    private shouldRecalculate = <T>(atom: ReadableAtom<T>, ignoreMounted: boolean): boolean => {
        const atomState = this.atomStateMap.get(atom) as AtomState<T> | undefined
        if (!atomState) {
            return true;
        }

        if (atomState.mounted && !ignoreMounted) {
            return false;
        }

        if (
            'dependencies' in atomState && Array.from(atomState.dependencies).every(([dep, epoch]) => {
                return this.readAtomState(dep).epoch === epoch
            })
        ) {
            return false;
        }

        return true;
    }

    private readComputedAtom<T>(atom: Computed<T>, ignoreMounted = false): ComputedState<T> {
        if (!this.shouldRecalculate(atom, ignoreMounted)) {
            return this.atomStateMap.get(atom) as ComputedState<T>;
        }

        const self: Computed<T> = atom;
        let atomState: ComputedState<T> | undefined = this.atomStateMap.get(self) as ComputedState<T> | undefined
        if (!atomState) {
            atomState = {
                dependencies: new Map<ReadableAtom<unknown>, number>(),
                epoch: -1,
            } as ComputedState<T>
            this.atomStateMap.set(self, atomState)
        }

        const lastDeps = atomState.dependencies;
        const readDeps = new Map<ReadableAtom<unknown>, number>();
        atomState.dependencies = readDeps;
        const wrappedGet: Getter = (depAtom) => {
            const depState = this.readAtomState(depAtom)

            // get 可能发生在异步过程中，当重复调用时，只有最新的 get 过程会修改 deps
            if (atomState.dependencies === readDeps) {
                readDeps.set(depAtom, depState.epoch);

                if (atomState.mounted && !depState.mounted) {
                    this.mount(depAtom).readDepts.add(self)
                } else if (depState.mounted) {
                    depState.mounted.readDepts.add(self)
                }
            }

            return depState.val;
        }


        const ret = self.read(wrappedGet, {
            get signal() {
                atomState.abortController?.abort(`abort ${self.debugLabel ?? 'anonymous'} atom`)
                atomState.abortController = new AbortController()
                return atomState.abortController.signal
            }
        });

        if (atomState.val !== ret) {
            atomState.val = ret;
            atomState.epoch += 1;
        }

        for (const key of lastDeps.keys()) {
            if (!readDeps.has(key)) {
                const otherState = this.atomStateMap.get(key)
                if (otherState?.mounted) {
                    otherState.mounted.readDepts.delete(self)
                }
            }
        }

        return atomState;
    }

    private readStateAtom<T>(atom: Value<T>): StateState<T> {
        const atomState = this.atomStateMap.get(atom);
        if (!atomState) {
            const initState = {
                val: atom.init,
                epoch: 0,
            }
            this.atomStateMap.set(atom, initState)
            return initState as StateState<T>
        }

        return atomState as StateState<T>
    }

    public readAtomState<T>(atom: Value<T>, ignoreMounted?: boolean): StateState<T>;
    public readAtomState<T>(atom: Computed<T>, ignoreMounted?: boolean): ComputedState<T>;
    public readAtomState<T>(atom: Value<T> | Computed<T>, ignoreMounted?: boolean): CommonReadableState<T>;
    public readAtomState<T>(atom: Value<T> | Computed<T>, ignoreMounted = false): StateState<T> | ComputedState<T> | CommonReadableState<T> {
        if (canReadAsCompute(atom)) {
            return this.readComputedAtom(atom, ignoreMounted)
        }

        return this.readStateAtom(atom)
    }

    public mount<T>(atom: ReadableAtom<T>): Mounted {
        const atomState = this.readAtomState(atom);

        atomState.mounted = atomState.mounted ?? {
            listeners: new Set(),
            readDepts: new Set(),
        }

        if ('dependencies' in atomState) {
            atomState.mounted.readDepcs = (atomState as ComputedState<T>).dependencies;
        }

        for (const [dep] of Array.from(atomState.mounted.readDepcs ?? EMPTY_MAP)) {
            const mounted = this.mount(dep)
            mounted.readDepts.add(atom)
        }

        return atomState.mounted
    }

    public unmount<T>(atom: ReadableAtom<T>): void {
        const atomState = this.atomStateMap.get(atom);
        if (!atomState?.mounted || atomState.mounted.listeners.size) {
            return
        }

        for (const [dep] of Array.from(atomState.mounted.readDepcs ?? EMPTY_MAP)) {
            const depState = this.readAtomState(dep)
            depState.mounted?.readDepts.delete(atom)
        }

        atomState.mounted = undefined;
    }

    public inited(atom: ReadableAtom<unknown>) {
        return this.atomStateMap.has(atom)
    }
}

export class ListenerManager {
    private pendingListeners = new Set<Effect<unknown, []>>();

    markPendingListeners(atomManager: AtomManager, atom: ReadableAtom<unknown>) {

        let queue = new Set([atom])
        while (queue.size > 0) {
            const nextQueue = new Set<ReadableAtom<unknown>>([])
            for (const atom of queue) {
                const atomState = atomManager.readAtomState(atom, true)

                for (const listener of atomState.mounted?.listeners ?? []) {
                    this.pendingListeners.add(listener)
                }

                for (const dep of Array.from(atomState.mounted?.readDepts ?? [])) {
                    nextQueue.add(dep)
                }
            }

            queue = nextQueue
        }
    }

    _debugGetPendingListeners = (): Effect<unknown, []>[] => {
        return Array.from(this.pendingListeners)
    }

    *notify(): Generator<Effect<unknown, []>, void, unknown> {
        const pendingListeners = this.pendingListeners
        this.pendingListeners = new Set()

        for (const listener of pendingListeners) {
            yield listener
        }
    }
}
