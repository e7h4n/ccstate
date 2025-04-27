import { transformSync } from '@babel/core';
import { expect, it } from 'vitest';
import plugin from '../plugin-debug-label';

const transform = (code: string, filename?: string, customAtomNames?: string[], projectRoot?: string) =>
  transformSync(code, {
    babelrc: false,
    configFile: false,
    filename,
    plugins: [[plugin, { customAtomNames, projectRoot }]],
  })?.code;

it('Should add a debugLabel to an atom', () => {
  expect(transform(`const count$ = state(0);`)).toMatchInlineSnapshot(`
    "const count$ = state(0, {
      debugLabel: "count$"
    });"
  `);
});

it('Should handle a atom from a default export', () => {
  expect(transform(`const count$ = ccstate.state(0);`)).toMatchInlineSnapshot(`
    "const count$ = ccstate.state(0, {
      debugLabel: "count$"
    });"
  `);
});

it('Should not replace existed debugLabel', () => {
  expect(transform(`const count$ = ccstate.state(0, { debugLabel: 'count' });`)).toMatchInlineSnapshot(`
    "const count$ = ccstate.state(0, {
      debugLabel: 'count'
    });"
  `);
});

it('Should add property to existed options', () => {
  expect(transform(`const count$ = ccstate.state(0, { foo: 'bar' });`)).toMatchInlineSnapshot(`
    "const count$ = ccstate.state(0, {
      foo: 'bar',
      debugLabel: "count$"
    });"
  `);
});

it('Should handle a atom being exported', () => {
  expect(transform(`export const count$ = state(0);`)).toMatchInlineSnapshot(`
    "export const count$ = state(0, {
      debugLabel: "count$"
    });"
  `);
});

it('Should handle a default exported atom', () => {
  expect(transform(`export default state(0);`, 'countAtom.ts')).toMatchInlineSnapshot(`
      "const countAtom = state(0, {
        debugLabel: "countAtom"
      });
      export default countAtom;"
    `);
});

it('Should handle a default exported atom even if no filename is provided', () => {
  expect(transform(`export default state(0);`)).toMatchInlineSnapshot(`
      "const unknownDefaultExportAtom = state(0, {
        debugLabel: "unknownDefaultExportAtom"
      });
      export default unknownDefaultExportAtom;"
    `);
});

it('Should handle a default exported by index.ts', () => {
  expect(transform(`export default state(0);`, 'atoms/index.ts')).toMatchInlineSnapshot(`
      "const atoms = state(0, {
        debugLabel: "atoms"
      });
      export default atoms;"
    `);
});

it('Should filter out projectRoot from the debugLabel', () => {
  expect(
    transform(
      `export default state(0);`,
      '/users/username/project/src/atoms/countAtom.ts',
      [],
      '/users/username/project/src/atoms/',
    ),
  ).toMatchInlineSnapshot(`
      "const countAtom = state(0, {
        debugLabel: "countAtom"
      });
      export default countAtom;"
    `);
});

it('Should handle a default exported atom in a barrel file', () => {
  expect(transform(`export default state(0);`, 'atoms/index.ts')).toMatchInlineSnapshot(`
      "const atoms = state(0, {
        debugLabel: "atoms"
      });
      export default atoms;"
    `);
});

it('Should handle all types of exports', () => {
  expect(
    transform(
      `
      export const countAtom = state(0);
      export default state(0);
    `,
      'atoms/index.ts',
    ),
  ).toMatchInlineSnapshot(`
    "export const countAtom = state(0, {
      debugLabel: "countAtom"
    });
    const atoms = state(0, {
      debugLabel: "atoms"
    });
    export default atoms;"
  `);
});

it('Should handle computed atoms', () => {
  expect(transform(`const double$ = computed((get) => get(count$));`)).toMatchInlineSnapshot(`
    "const double$ = computed(function __ccs_cmpt_double$(get) {
      return get(count$);
    }, {
      debugLabel: "double$"
    });"
  `);
});

it('Should handle command atoms', () => {
  expect(
    transform(`const updateDouble$ = command(({get, set}, value) => {
      set(double$, get(count$) + value)
    });`),
  ).toMatchInlineSnapshot(`
    "const updateDouble$ = command(function __ccs_cmd_updateDouble$({
      get,
      set
    }, value) {
      set(double$, get(count$) + value);
    }, {
      debugLabel: "updateDouble$"
    });"
  `);
});

it('Should handle command with anonymous arrow function', () => {
  expect(transform(`const doSomething$ = command((ctx, x) => { ctx.set(count$, x); });`)).toMatchInlineSnapshot(`
    "const doSomething$ = command(function __ccs_cmd_doSomething$(ctx, x) {
      ctx.set(count$, x);
    }, {
      debugLabel: \"doSomething$\"
    });"
    `);
});

it('Should not rename command if already a named function', () => {
  expect(transform(`const doSomething$ = command(function myCmd(ctx, x) { ctx.set(count$, x); });`))
    .toMatchInlineSnapshot(`
    "const doSomething$ = command(function myCmd(ctx, x) {
      ctx.set(count$, x);
    }, {
      debugLabel: \"doSomething$\"
    });"
    `);
});

it('Should handle command with async arrow function', () => {
  expect(transform(`const doAsync$ = command(async (ctx, x) => { await ctx.set(count$, x); });`))
    .toMatchInlineSnapshot(`
    "const doAsync$ = command(async function __ccs_cmd_doAsync$(ctx, x) {
      await ctx.set(count$, x);
    }, {
      debugLabel: \"doAsync$\"
    });"
    `);
});

it('Should not rename command if already a named async function', () => {
  expect(transform(`const doAsync$ = command(async function myAsyncCmd(ctx, x) { await ctx.set(count$, x); });`))
    .toMatchInlineSnapshot(`
    "const doAsync$ = command(async function myAsyncCmd(ctx, x) {
      await ctx.set(count$, x);
    }, {
      debugLabel: \"doAsync$\"
    });"
    `);
});

it('Handles custom atom names a debugLabel to an atom', () => {
  expect(transform(`const mySpecialThing = myCustomAtom(0);`, undefined, ['myCustomAtom'])).toMatchInlineSnapshot(`
    "const mySpecialThing = myCustomAtom(0, {
      debugLabel: "mySpecialThing"
    });"
  `);
});

it('handles function return values', () => {
  expect(
    transform(`
    function createAtomPair(init) {
      const internal = state(init);
      return [
        computed(get => get(internal)),
        command(({get, set}, value) => {
          set(internal, value)
        }),
      ]
    }
    `),
  ).toMatchInlineSnapshot(`
    "function createAtomPair(init) {
      const internal = state(init, {
        debugLabel: "internal"
      });
      return [computed(get => get(internal)), command(({
        get,
        set
      }, value) => {
        set(internal, value);
      })];
    }"
  `);
});

it('Should not rename if already a named function', () => {
  expect(transform(`const double$ = computed(function myDouble(get) { return get(count$); });`)).toMatchInlineSnapshot(`
    "const double$ = computed(function myDouble(get) {
      return get(count$);
    }, {
      debugLabel: \"double$\"
    });"
    `);
});

it('Should handle async arrow function', () => {
  expect(transform(`const double$ = computed(async (get) => { return await get(count$); });`)).toMatchInlineSnapshot(`
    "const double$ = computed(async function __ccs_cmpt_double$(get) {
      return await get(count$);
    }, {
      debugLabel: \"double$\"
    });"
    `);
});

it('Should not rename if already a named async function', () => {
  expect(transform(`const double$ = computed(async function myAsync(get) { return await get(count$); });`))
    .toMatchInlineSnapshot(`
    "const double$ = computed(async function myAsync(get) {
      return await get(count$);
    }, {
      debugLabel: \"double$\"
    });"
    `);
});

it('Should not convert arrow function using this', () => {
  expect(transform(`const double$ = computed(() => { return this.value; });`)).toMatchInlineSnapshot(`
    "const double$ = computed(() => {
      return this.value;
    }, {
      debugLabel: \"double$\"
    });"
    `);
});

it('Should handle multi-parameter computed', () => {
  expect(transform(`const sum$ = computed((a, b) => a + b);`)).toMatchInlineSnapshot(`
    "const sum$ = computed(function __ccs_cmpt_sum$(a, b) {
      return a + b;
    }, {
      debugLabel: \"sum$\"
    });"
    `);
});

it('Should not add debugLabel if already present in options', () => {
  expect(transform(`const double$ = computed((get) => get(count$), { debugLabel: 'customLabel' });`))
    .toMatchInlineSnapshot(`
    "const double$ = computed(function __ccs_cmpt_double$(get) {
      return get(count$);
    }, {
      debugLabel: 'customLabel'
    });"
    `);
});

it('Should not break when computed/command is used as object property', () => {
  expect(transform(`const obj = { cmpt: computed(get => get(x)) };`)).toMatchInlineSnapshot(`
    "const obj = {
      cmpt: computed(get => get(x))
    };"
    `);
});

it('Should not break when computed/command is used as array element', () => {
  expect(transform(`const arr = [computed(get => get(x))];`)).toMatchInlineSnapshot(`
    "const arr = [computed(get => get(x))];"
    `);
});

it('Should handle export default computed', () => {
  expect(transform(`export default computed(get => get(x));`, 'foo.ts')).toMatchInlineSnapshot(`
    "const foo = computed(function __ccs_cmpt_foo(get) {
      return get(x);
    }, {
      debugLabel: \"foo\"
    });
    export default foo;"
    `);
});

it('Should handle computed/command with no parameters', () => {
  expect(transform(`const always$ = computed(() => 1);`)).toMatchInlineSnapshot(`
    "const always$ = computed(function __ccs_cmpt_always$() {
      return 1;
    }, {
      debugLabel: \"always$\"
    });"
    `);
  expect(transform(`const noop$ = command(() => {});`)).toMatchInlineSnapshot(`
    "const noop$ = command(function __ccs_cmd_noop$() {}, {
      debugLabel: \"noop$\"
    });"
    `);
});

it('Should handle async arrow function with return statement', () => {
  expect(transform(`const foo$ = computed(async (get) => { await foo(); return bar; });`)).toMatchInlineSnapshot(`
    "const foo$ = computed(async function __ccs_cmpt_foo$(get) {
      await foo();
      return bar;
    }, {
      debugLabel: \"foo$\"
    });"
    `);
});
