import { render, cleanup, screen } from '@testing-library/svelte';
import { afterEach, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import Prop from './Prop.svelte';

afterEach(() => {
  cleanup();
});

it('prop takes same atom', async () => {
  const obj = {};
  let callbackObj: object | undefined;

  render(Prop, {
    props: {
      obj: () => obj,
      cb: (obj: object) => {
        callbackObj = obj;
      },
    },
  });

  expect(await screen.findByText('done')).toBeInTheDocument();
  expect(callbackObj).toBe(obj);
});
