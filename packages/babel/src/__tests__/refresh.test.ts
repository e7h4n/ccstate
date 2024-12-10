import { transformSync } from '@babel/core';
import { expect, it } from 'vitest';
import plugin from '../plugin-react-refresh';

const transform = (code: string, filename?: string, customAtomNames?: string[]) =>
  transformSync(code, {
    babelrc: false,
    configFile: false,
    filename,
    root: '.',
    plugins: [[plugin, { customAtomNames }]],
  })?.code;

it('Should add a cache for a single atom', () => {
  expect(transform(`const count$ = $value(0);`, '/src/atoms/index.ts')).toMatchInlineSnapshot(`
      "globalThis.ripplingAtomCache = globalThis.ripplingAtomCache || {
        cache: new Map(),
        get(name, inst) {
          if (this.cache.has(name)) {
            return this.cache.get(name);
          }
          this.cache.set(name, inst);
          return inst;
        }
      };
      const count$ = globalThis.ripplingAtomCache.get("/src/atoms/index.ts/count$", $value(0));"
    `);
});

it('Should add a cache for multiple atoms', () => {
  expect(
    transform(
      `
  const count$ = $value(0);
  const double$ = $computed((get) => get(count$) * 2);
  `,
      '/src/atoms/index.ts',
    ),
  ).toMatchInlineSnapshot(`
    "globalThis.ripplingAtomCache = globalThis.ripplingAtomCache || {
      cache: new Map(),
      get(name, inst) {
        if (this.cache.has(name)) {
          return this.cache.get(name);
        }
        this.cache.set(name, inst);
        return inst;
      }
    };
    const count$ = globalThis.ripplingAtomCache.get("/src/atoms/index.ts/count$", $value(0));
    const double$ = globalThis.ripplingAtomCache.get("/src/atoms/index.ts/double$", $computed(get => get(count$) * 2));"
  `);
});

it('Should add a cache for multiple exported atoms', () => {
  expect(
    transform(
      `
  export const count$ = $value(0);
  export const double$ = $computed((get) => get(count$) * 2);
  `,
      '/src/atoms/index.ts',
    ),
  ).toMatchInlineSnapshot(`
    "globalThis.ripplingAtomCache = globalThis.ripplingAtomCache || {
      cache: new Map(),
      get(name, inst) {
        if (this.cache.has(name)) {
          return this.cache.get(name);
        }
        this.cache.set(name, inst);
        return inst;
      }
    };
    export const count$ = globalThis.ripplingAtomCache.get("/src/atoms/index.ts/count$", $value(0));
    export const double$ = globalThis.ripplingAtomCache.get("/src/atoms/index.ts/double$", $computed(get => get(count$) * 2));"
  `);
});

it('Should add a cache for a default exported atom', () => {
  expect(transform(`export default $value(0);`, '/src/atoms/index.ts')).toMatchInlineSnapshot(`
      "globalThis.ripplingAtomCache = globalThis.ripplingAtomCache || {
        cache: new Map(),
        get(name, inst) {
          if (this.cache.has(name)) {
            return this.cache.get(name);
          }
          this.cache.set(name, inst);
          return inst;
        }
      };
      export default globalThis.ripplingAtomCache.get("/src/atoms/index.ts/defaultExport", $value(0));"
    `);
});

it('Should add a cache for mixed exports of atoms', () => {
  expect(
    transform(
      `
  export const count$ = $value(0);
  export default $computed((get) => get(count$) * 2);
  `,
      '/src/atoms/index.ts',
    ),
  ).toMatchInlineSnapshot(`
    "globalThis.ripplingAtomCache = globalThis.ripplingAtomCache || {
      cache: new Map(),
      get(name, inst) {
        if (this.cache.has(name)) {
          return this.cache.get(name);
        }
        this.cache.set(name, inst);
        return inst;
      }
    };
    export const count$ = globalThis.ripplingAtomCache.get("/src/atoms/index.ts/count$", $value(0));
    export default globalThis.ripplingAtomCache.get("/src/atoms/index.ts/defaultExport", $computed(get => get(count$) * 2));"
  `);
});

it('Should fail if no filename is available', () => {
  expect(() => transform(`const countAtom = atom(0);`)).toThrow('Filename must be available');
});

it('Should handle atoms returned from functions (#891)', () => {
  expect(
    transform(
      `function createAtom(label) {
    const anAtom = $value(0, { debugLabel: label });
    return anAtom;
  }
  
  const count$ = $value(0);
  const count$2 = createAtom("countAtom2");
  const count$3 = createAtom("countAtom3");`,
      '/src/atoms/index.ts',
    ),
  ).toMatchInlineSnapshot(`
    "globalThis.ripplingAtomCache = globalThis.ripplingAtomCache || {
      cache: new Map(),
      get(name, inst) {
        if (this.cache.has(name)) {
          return this.cache.get(name);
        }
        this.cache.set(name, inst);
        return inst;
      }
    };
    function createAtom(label) {
      const anAtom = $value(0, {
        debugLabel: label
      });
      return anAtom;
    }
    const count$ = globalThis.ripplingAtomCache.get("/src/atoms/index.ts/count$", $value(0));
    const count$2 = createAtom("countAtom2");
    const count$3 = createAtom("countAtom3");"
  `);
});

it('Should handle custom atom names', () => {
  expect(transform(`const mySpecialThing = myCustomAtom(0);`, '/src/atoms/index.ts', ['myCustomAtom']))
    .toMatchInlineSnapshot(`
    "globalThis.ripplingAtomCache = globalThis.ripplingAtomCache || {
      cache: new Map(),
      get(name, inst) {
        if (this.cache.has(name)) {
          return this.cache.get(name);
        }
        this.cache.set(name, inst);
        return inst;
      }
    };
    const mySpecialThing = globalThis.ripplingAtomCache.get("/src/atoms/index.ts/mySpecialThing", myCustomAtom(0));"
  `);
});
