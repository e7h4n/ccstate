import type { NestedAtom } from '../../types/debug/debug-store';

export type NestedString = (string | NestedString)[];

export function nestedAtomToString(atoms: NestedAtom): NestedString {
  return atoms.map((atom) => {
    if (Array.isArray(atom)) {
      return nestedAtomToString(atom);
    }
    return atom.debugLabel ?? 'anonymous';
  });
}
