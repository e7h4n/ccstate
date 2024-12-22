# Using in Vanilla JS

Using CCState in Vanilla JS is quite simple & straightforward, `get` to fetch values, and `sub` to trigger re-renders.

```js
// user.js
import { computed, state } from 'ccstate/core';

export const userId$ = state('');

export const user$ = computed(async (get) => {
  const userId = get(userId$);
  if (!userId) {
    return null;
  }

  return fetch(`https://api.github.com/users/${userId}`).then((resp) => resp.json());
});

//template.js
import { computed } from 'ccstate/core';
import { user$ } from './user.mjs';

export const containerEl$ = computed(() => {
  return document.createElement('div');
});

export const userEl$ = computed(async (get) => {
  const user = await get(user$);
  const el = document.createElement('div');
  if (!user) {
    return el;
  }

  el.innerHTML = `
          <h1>${user.name}</h1>
          <img src="${user.avatar_url}" alt="${user.name}" />
      `;
  return el;
});

// main.js
import { command, createStore } from 'ccstate/core';
import { userId$ } from './user.mjs';
import { containerEl$, userEl$ } from './template.mjs';

const render$ = command(async ({ get, set }) => {
  const shown = !!get(userId$);
  const mainEl = get(containerEl$);
  mainEl.innerHTML = `
    <button class="show">${shown ? 'hide' : 'show'}</button>
    <div>Loading...</div>
  `;
  const userEl = await get(userEl$);
  mainEl.innerHTML = `<button class="show">${shown ? 'hide' : 'show'}</button>`;
  mainEl.appendChild(userEl);
});

const main$ = command(async ({ get, set }) => {
  const mainEl = get(containerEl$);
  document.body.appendChild(mainEl);
  set(render$);

  mainEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('show')) {
      const userId = get(userId$);
      set(userId$, userId === 'e7h4n' ? '' : 'e7h4n');
      set(render$);
    }
  });
});

createStore().set(main$);
```
