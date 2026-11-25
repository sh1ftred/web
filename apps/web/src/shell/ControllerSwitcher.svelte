<script lang="ts">
  import { tick } from 'svelte';
  import Overlay from './Overlay.svelte';
  import type { ListedWindow } from './window-store.svelte';

  const { items, initial, step, onchoose, onminimise, onclosewindow, onstacks, onclose }: {
    items: readonly ListedWindow[]; initial: string | undefined; step: number;
    onminimise: (id: string) => void; onclosewindow: (id: string) => void;
    onchoose: (id: string) => void; onstacks: () => void; onclose: () => void;
  } = $props();
  let list: HTMLDivElement;

  function move(from: number, delta: number): void {
    const buttons = [...list.querySelectorAll('button[data-choice]')];
    if (!buttons.length) return;
    const index = from < 0 ? (delta < 0 ? buttons.length - 1 : 0) : (from + delta + buttons.length) % buttons.length;
    buttons[index]?.focus();
  }

  export function cycle(delta: number): void {
    const buttons = [...list.querySelectorAll('button[data-choice]')];
    move(buttons.indexOf(document.activeElement as HTMLButtonElement), delta);
  }

  const start = () => {
    // The overlay installs its focus trap before the switcher chooses a window.
    void tick().then(() => {
      if (list?.isConnected) move(items.findIndex((item) => item.id === initial), step);
    });
  };
</script>

<Overlay title="Controller switcher" {onclose}>
  <p class="shell-muted">Bumpers pick a window. Press A / × to enter it, Y / △ for stacks, or B / ○ to return to the desktop.</p>
  <div class="choices" bind:this={list} {@attach start}>
    {#each items as item (item.id)}
      <div class="choice">
        <button type="button" data-choice class="shell-button" onclick={() => onchoose(item.id)}>{item.title}</button>
        <button type="button" class="shell-button quiet" disabled={item.minimised} aria-label="Minimise {item.title}" onclick={() => onminimise(item.id)}>Minimise</button>
        <button type="button" class="shell-button quiet" aria-label="Close {item.title}" onclick={() => onclosewindow(item.id)}>Close</button>
      </div>
    {/each}
    <button type="button" class="shell-button primary" onclick={onstacks}>Browse stacks</button>
  </div>
</Overlay>

<style>
  .choices { display: grid; gap: 0.5rem; }
  .choice { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 0.35rem; }
  .choices button:focus { outline: 3px solid var(--accent); outline-offset: 2px; }
</style>
