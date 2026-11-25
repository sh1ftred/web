import { parseHTML } from 'linkedom';
import { After, Given, Then } from 'quickpickle';
import { expect, vi } from 'vitest';
import { padFocus } from '../../src/shell/pad-focus.ts';

interface FocusWorld {
  padRoot: HTMLElement;
  padClicks: string[];
  padChanges: number;
}

Given('these shell controller controls:', (world: FocusWorld, html: string) => {
  const { document, Event } = parseHTML(`<main>${html}</main>`);
  world.padRoot = document.querySelector('main')!;
  world.padClicks = [];
  world.padChanges = 0;
  // Linkedom provides selectors, bubbling and details structure, but not browser layout or focus tracking.
  let active: HTMLElement | undefined;
  Object.defineProperty(document, 'activeElement', { get: () => active });
  vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible' }));
  vi.stubGlobal('Event', Event);
  for (const el of world.padRoot.querySelectorAll<HTMLElement>('*')) {
    Object.assign(el, { getClientRects: () => [{}], scrollIntoView: () => {}, focus: () => {
      if (el !== active) active?.blur();
      active = el;
    } });
  }
  const select = world.padRoot.querySelector('select');
  if (select) select.selectedIndex = 0;
  world.padRoot.addEventListener('click', (e) => world.padClicks.push((e.target as HTMLElement).id));
  world.padRoot.addEventListener('change', () => world.padChanges++);
});

After((world: FocusWorld) => { if (world.padRoot) vi.unstubAllGlobals(); });

Then('controller movements {string} focus {string}', (world: FocusWorld, commands: string, expected: string) => {
  const steps = commands.split(' ') as Parameters<typeof padFocus>[1][];
  const path = steps.map((cmd) => {
    padFocus(world.padRoot, cmd);
    return world.padRoot.ownerDocument.activeElement?.id ?? 'nothing';
  });
  expect(path).toEqual(expected.split(' '));
});

Then('the shell controller clicked only {string}', (world: FocusWorld, id: string) => expect(world.padClicks).toEqual([id]));
Then('the shell controller did not click', (world: FocusWorld) => expect(world.padClicks).toEqual([]));
Then('the controller selection is option {int} after {int} change(s)', (world: FocusWorld, index: number, count: number) => {
  expect(world.padRoot.querySelector('select')!.selectedIndex).toBe(index);
  expect(world.padChanges).toBe(count);
});
