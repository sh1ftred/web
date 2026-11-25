<script lang="ts">
  import type { CachedOutboxEvent } from './contract';
  import Overlay from './Overlay.svelte';

  interface Props {
    events: readonly CachedOutboxEvent[] | undefined;
    onclose: () => void;
  }

  const { events, onclose }: Props = $props();
</script>

<Overlay title="Cached events" {onclose}>
  <p class="shell-muted">Public events kept from live Outbox subscriptions in this tab. One event can have several sources.</p>
  {#if !events}
    <p>The Outbox cache is not available in this mode.</p>
  {:else if events.length === 0}
    <p>No events are cached yet.</p>
  {:else}
    <p>{events.length} {events.length === 1 ? 'event' : 'events'}, newest first</p>
    <ul class="shell-list" aria-label="Outbox cache entries">
      {#each events as event (event.id)}
        {@const date = new Date(event.createdAt * 1000)}
        <li>
          <div><strong>Kind {event.kind}</strong> · <time datetime={date.toJSON() ?? undefined}>{date.toLocaleString()}</time></div>
          <code>{event.id}</code>
          <div class="shell-muted">{event.relays.join(', ')}</div>
        </li>
      {/each}
    </ul>
  {/if}
</Overlay>

<style>
  li > div,
  code {
    overflow-wrap: anywhere;
  }
</style>
