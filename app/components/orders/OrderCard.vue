<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { Order } from '~/types/api';
import { canTransition, MODE_UI, NEXT_ACTION, orderWhere, PAYMENT_STATUS } from '~/utils/order-status';

const props = defineProps<{ order: Order; now: number }>();
const emit = defineEmits<{ open: [order: Order] }>();

const restaurant = useRestaurantStore();
const { money } = useMoney();
const { changeStatus, busy } = useOrderActions();

const next = computed(() => NEXT_ACTION[props.order.status]);
const isLate = computed(
  () =>
    !!props.order.estimatedReadyAt &&
    ['PENDING', 'ACCEPTED', 'PREPARING'].includes(props.order.status) &&
    props.now > new Date(props.order.estimatedReadyAt).getTime(),
);
const itemsCount = computed(() => props.order.items.reduce((s, i) => s + i.quantity, 0));

const menu = computed<DropdownMenuItem[]>(() => {
  const items: DropdownMenuItem[] = [
    { label: 'Voir le détail', icon: 'i-lucide-panel-right-open', onSelect: () => emit('open', props.order) },
  ];
  if (canTransition(props.order.status, 'REJECTED') && restaurant.can('orders.manage')) {
    items.push({
      label: 'Refuser',
      icon: 'i-lucide-circle-x',
      color: 'error',
      onSelect: () => changeStatus(props.order, 'REJECTED'),
    });
  }
  if (canTransition(props.order.status, 'CANCELLED') && restaurant.can('orders.cancel')) {
    items.push({
      label: 'Annuler',
      icon: 'i-lucide-ban',
      color: 'error',
      onSelect: () => changeStatus(props.order, 'CANCELLED'),
    });
  }
  return items;
});
</script>

<template>
  <article
    class="group rounded-lg border bg-default p-3 shadow-xs transition hover:shadow-md"
    :class="[
      order.isRush ? 'border-primary ring-1 ring-primary/40' : 'border-default',
      isLate && 'border-error/60',
    ]"
  >
    <button type="button" class="w-full text-start" @click="emit('open', order)">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="font-display text-lg font-semibold leading-tight text-highlighted">n°{{ order.number }}</p>
          <p class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold" :class="MODE_UI[order.mode].badge">
              <UIcon :name="MODE_UI[order.mode].icon" class="size-3.5" />{{ orderWhere(order) }}
            </span>
            <span v-if="order.customerName">{{ order.customerName }}</span>
          </p>
        </div>
        <div class="flex flex-col items-end gap-1">
          <span class="tabular text-xs" :class="isLate ? 'font-semibold text-error' : 'text-muted'">
            <UIcon name="i-lucide-clock" class="-mt-0.5 size-3.5 align-middle" />
            {{ formatAge(order.createdAt, now) }}
          </span>
          <UBadge v-if="order.isRush" color="primary" variant="solid" size="xs" label="Prioritaire" />
          <UBadge v-else-if="isLate" color="error" variant="subtle" size="xs" label="En retard" />
        </div>
      </div>

      <ul class="mt-2 space-y-0.5 text-sm">
        <li v-for="item in order.items.slice(0, 4)" :key="item.id" class="flex gap-2">
          <span class="tabular font-medium text-highlighted">{{ item.quantity }}×</span>
          <span class="min-w-0 truncate">
            {{ item.name }}
            <span v-if="item.options.length" class="text-muted">· {{ item.options.map((o) => o.name).join(', ') }}</span>
          </span>
        </li>
        <li v-if="order.items.length > 4" class="text-xs text-muted">+ {{ order.items.length - 4 }} autre(s) article(s)</li>
      </ul>
      <p v-if="order.notes" class="mt-2 rounded bg-warning/10 px-2 py-1 text-xs text-warning">
        <UIcon name="i-lucide-message-square-text" class="-mt-0.5 size-3.5 align-middle" /> {{ order.notes }}
      </p>
    </button>

    <div class="mt-3 flex items-center justify-between gap-2 border-t border-default pt-2">
      <div class="min-w-0">
        <p class="tabular text-sm font-semibold text-highlighted">{{ money(order.total, order.currency) }}</p>
        <p class="truncate text-xs" :class="order.paymentStatus === 'PAID' ? 'text-success' : 'text-muted'">
          {{ PAYMENT_STATUS[order.paymentStatus]?.label }} · {{ itemsCount }} art.
        </p>
      </div>
      <div class="flex items-center gap-1">
        <UButton
          v-if="next && restaurant.can('orders.manage')"
          size="sm"
          :icon="next.icon"
          :label="next.label"
          :loading="busy === order.id"
          @click="changeStatus(order, next.to)"
        />
        <UDropdownMenu :items="menu" :content="{ align: 'end' }">
          <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-ellipsis-vertical" aria-label="Plus d'actions" />
        </UDropdownMenu>
      </div>
    </div>
  </article>
</template>
