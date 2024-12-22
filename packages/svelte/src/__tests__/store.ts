import { command, state } from 'ccstate';

export const count$ = state(0);

export const doubleIncrease$ = command(({ get, set }, x: number) => {
  set(count$, get(count$) + x * 2);
});
