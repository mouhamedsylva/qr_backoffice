<script setup lang="ts">
/** Ticket de cuisine : un tap fait avancer une ligne, « Tout prêt » envoie la commande (KDS-01 à KDS-03). */
import type { KitchenItemStatus, KitchenTicket } from '~/types/api';
import { MODE_LABEL } from '~/utils/order-status';

const props = defineProps<{ ticket: KitchenTicket; now: number; canManage: boolean; busy: boolean }>();
const emit = defineEmits<{
  item: [itemId: string, status: KitchenItemStatus];
  bump: [status: 'IN_PROGRESS' | 'READY'];
  rush: [isRush: boolean];
}>();

const NEXT: Record<KitchenItemStatus, KitchenItemStatus> = { PENDING: 'IN_PROGRESS', IN_PROGRESS: 'READY', READY: 'PENDING' };

const age = computed(() => formatAge(props.ticket.createdAt, props.now));
const urgency = computed(() => {
  const t = props.ticket;
  if (t.estimatedReadyAt && props.now >= new Date(t.estimatedReadyAt).getTime()) return 'late';
  return t.urgency;
});

const HEADER: Record<string, string> = {
  normal: 'bg-elevated text-highlighted',
  warning: 'bg-warning/20 text-highlighted',
  late: 'bg-error text-white',
};

// Lignes groupées par vague d'ajout (batch) : les ajouts arrivent en bas.
const batches = computed(() => {
  const map = new Map<number, KitchenTicket['items']>();
  for (const item of props.ticket.items) map.set(item.batch, [...(map.get(item.batch) ?? []), item]);
  return [...map.entries()].sort(([a], [b]) => a - b);
});

const allStarted = computed(() => props.ticket.items.every((i) => i.kitchenStatus !== 'PENDING'));
</script>

<template>
  <article
    class="flex flex-col overflow-hidden rounded-xl border-2 bg-default shadow-sm"
    :class="ticket.isRush ? 'border-primary' : urgency === 'late' ? 'border-error' : 'border-default'"
  >
    <header class="flex items-start justify-between gap-2 px-3 py-2" :class="HEADER[urgency]">
      <div class="min-w-0">
        <p class="font-display text-2xl leading-none font-bold">n°{{ ticket.number }}</p>
        <p class="mt-1 truncate text-sm font-medium" :class="urgency === 'late' ? 'text-white/90' : 'text-muted'">
          {{ ticket.table ? `Table ${ticket.table}` : MODE_LABEL[ticket.mode] }}
          <template v-if="ticket.customerName"> · {{ ticket.customerName }}</template>
        </p>
      </div>
      <div class="flex flex-col items-end gap-1">
        <span class="tabular text-lg font-semibold">{{ age }}</span>
        <UButton
          v-if="canManage"
          size="xs"
          :color="ticket.isRush ? 'primary' : 'neutral'"
          :variant="ticket.isRush ? 'solid' : 'soft'"
          icon="i-lucide-zap"
          :label="ticket.isRush ? 'Prioritaire' : 'Priorité'"
          @click="emit('rush', !ticket.isRush)"
        />
      </div>
    </header>

    <p v-if="ticket.notes" class="bg-warning/15 px-3 py-1.5 text-sm font-medium text-warning">
      <UIcon name="i-lucide-message-square-warning" class="-mt-0.5 align-middle" /> {{ ticket.notes }}
    </p>

    <div class="flex-1 divide-y divide-default">
      <div v-for="[batch, items] in batches" :key="batch">
        <p v-if="batch > 1" class="bg-info/10 px-3 py-1 text-xs font-semibold text-info uppercase">Ajout n°{{ batch - 1 }}</p>
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="flex w-full items-start gap-3 px-3 py-2.5 text-start transition enabled:hover:bg-elevated/60"
          :class="item.kitchenStatus === 'READY' && 'opacity-50'"
          :disabled="!canManage || busy"
          :aria-label="`${item.quantity} ${item.name}`"
          @click="emit('item', item.id, NEXT[item.kitchenStatus])"
        >
          <span
            class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2"
            :class="{
              'border-default': item.kitchenStatus === 'PENDING',
              'border-kitchen bg-kitchen/15 text-kitchen': item.kitchenStatus === 'IN_PROGRESS',
              'border-success bg-success text-white': item.kitchenStatus === 'READY',
            }"
          >
            <UIcon v-if="item.kitchenStatus === 'IN_PROGRESS'" name="i-lucide-flame" class="size-3.5" />
            <UIcon v-else-if="item.kitchenStatus === 'READY'" name="i-lucide-check" class="size-3.5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-base leading-tight font-semibold" :class="item.kitchenStatus === 'READY' && 'line-through'">
              <span class="tabular">{{ item.quantity }}×</span> {{ item.name }}
            </span>
            <span v-if="item.options.length" class="block text-sm text-muted">{{ item.options.join(' · ') }}</span>
            <span v-if="item.notes" class="block text-sm font-medium text-warning">« {{ item.notes }} »</span>
          </span>
          <span
            v-if="item.station"
            class="mt-1 size-2.5 shrink-0 rounded-full"
            :style="{ backgroundColor: item.station.color ?? 'var(--ui-text-dimmed)' }"
            :title="item.station.name"
          />
        </button>
      </div>
    </div>

    <footer v-if="canManage" class="grid grid-cols-2 gap-2 border-t border-default p-2">
      <UButton
        block
        color="neutral"
        variant="soft"
        icon="i-lucide-flame"
        label="Tout lancer"
        :disabled="allStarted"
        :loading="busy"
        @click="emit('bump', 'IN_PROGRESS')"
      />
      <UButton block color="success" icon="i-lucide-bell" label="Tout prêt" :loading="busy" @click="emit('bump', 'READY')" />
    </footer>
  </article>
</template>
