<script setup lang="ts">
import { useNow } from '@vueuse/core';
import type { Order } from '~/types/api';
import { LIVE_COLUMNS, ORDER_STATUS, type StatusColor } from '~/utils/order-status';

useHead({ title: 'Commandes · QR-Order' });

const route = useRoute();
const router = useRouter();
const restaurant = useRestaurantStore();
const orders = useOrdersStore();
const realtime = useRealtime();
const alerts = useOrderAlerts();
const now = useNow({ interval: 15_000 });

const tab = ref<'live' | 'history'>(route.query.tab === 'history' ? 'history' : 'live');
const tabs = [
  { label: 'En direct', value: 'live', icon: 'i-lucide-radio' },
  { label: 'Historique', value: 'history', icon: 'i-lucide-history' },
];
watch(tab, (value) => router.replace({ query: { ...route.query, tab: value === 'live' ? undefined : value } }));

// La page est ouverte : les nouvelles commandes sont « vues ».
onMounted(() => alerts.markRead());
watch(() => orders.pendingCount, () => alerts.markRead());

// Fiche de détail pilotée par l'URL (?order=…), partageable et compatible retour arrière.
const selectedId = computed(() => (typeof route.query.order === 'string' ? route.query.order : null));
function openOrder(order: Order) {
  router.replace({ query: { ...route.query, order: order.id } });
}
function closeOrder() {
  const { order: _omit, ...rest } = route.query;
  router.replace({ query: rest });
}

const newOrderOpen = ref(false);
const history = useTemplateRef<{ refresh: () => Promise<void> }>('history');

// L'historique se met à jour avec les évènements reçus.
realtime.on('order.status_changed', () => tab.value === 'history' && history.value?.refresh());
realtime.on('order.created', () => tab.value === 'history' && history.value?.refresh());

const counts = computed(() => LIVE_COLUMNS.map((s) => orders.byStatus[s]?.length ?? 0));
const totalActive = computed(() => counts.value.reduce((a, b) => a + b, 0));

// Classes écrites en toutes lettres pour que Tailwind les génère.
const ICON_CLASS: Record<StatusColor, string> = {
  warning: 'text-warning',
  info: 'text-info',
  kitchen: 'text-kitchen',
  success: 'text-success',
  neutral: 'text-muted',
  error: 'text-error',
};

const COLUMN_HINT: Record<string, string> = {
  PENDING: 'Nouvelles commandes à valider',
  ACCEPTED: 'Validées, en attente de lancement',
  PREPARING: 'En cours en cuisine',
  READY: 'À servir ou à remettre',
  SERVED: 'À clôturer après paiement',
};
</script>

<template>
  <UDashboardPanel id="orders" :ui="{ body: tab === 'live' ? 'p-0 sm:p-0' : undefined }">
    <template #header>
      <UDashboardNavbar title="Commandes">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #trailing>
          <UBadge v-if="totalActive" color="neutral" variant="subtle" :label="`${totalActive} en cours`" />
        </template>
        <template #right>
          <UTooltip :text="realtime.connected.value ? 'Temps réel connecté' : 'Reconnexion en cours…'">
            <span class="flex items-center gap-1.5 text-xs text-muted">
              <span
                class="size-2 rounded-full"
                :class="realtime.connected.value ? 'bg-success animate-pulse' : 'bg-warning'"
              />
              <span class="hidden sm:inline">{{ realtime.connected.value ? 'En direct' : 'Hors ligne' }}</span>
            </span>
          </UTooltip>
          <UButton
            v-if="restaurant.can('orders.manage')"
            icon="i-lucide-plus"
            label="Nouvelle commande"
            @click="newOrderOpen = true"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <UTabs v-model="tab" :items="tabs" :content="false" variant="link" size="sm" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <!-- En direct : une colonne par étape du workflow -->
      <div v-if="tab === 'live'" class="flex h-full gap-4 overflow-x-auto p-4 sm:p-6">
        <section
          v-for="(status, index) in LIVE_COLUMNS"
          :key="status"
          class="flex w-72 shrink-0 flex-col rounded-xl bg-elevated/50 xl:w-auto xl:min-w-0 xl:flex-1"
        >
          <header class="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
            <div class="flex items-center gap-2">
              <UIcon :name="ORDER_STATUS[status].icon" class="size-4" :class="ICON_CLASS[ORDER_STATUS[status].color]" />
              <h2 class="text-sm font-semibold text-highlighted">{{ ORDER_STATUS[status].label }}</h2>
              <UBadge :color="ORDER_STATUS[status].color" variant="subtle" size="sm" :label="String(counts[index])" />
            </div>
          </header>
          <p class="px-3 pb-2 text-xs text-muted">{{ COLUMN_HINT[status] }}</p>

          <div class="flex-1 space-y-2 overflow-y-auto px-2 pb-3">
            <template v-if="orders.loading && !orders.active.length">
              <USkeleton v-for="n in 2" :key="n" class="h-36 w-full rounded-lg" />
            </template>
            <TransitionGroup
              v-else
              tag="div"
              class="space-y-2"
              enter-from-class="opacity-0 -translate-y-2"
              enter-active-class="transition duration-300"
              leave-to-class="opacity-0"
              leave-active-class="transition duration-200 absolute"
              move-class="transition duration-300"
            >
              <OrdersOrderCard
                v-for="order in orders.byStatus[status]"
                :key="order.id"
                :order="order"
                :now="now.getTime()"
                @open="openOrder"
              />
            </TransitionGroup>
            <p
              v-if="!orders.loading && !counts[index]"
              class="rounded-lg border border-dashed border-default py-8 text-center text-xs text-dimmed"
            >
              Aucune commande
            </p>
          </div>
        </section>
      </div>

      <!-- Historique -->
      <OrdersHistoryTable v-else ref="history" @open="openOrder" />

      <!-- Fenêtres téléportées : leur place dans l'arbre n'affecte pas la mise en page. -->
      <OrdersOrderDetailSlideover :order-id="selectedId" @close="closeOrder" />
      <OrdersNewOrderModal v-model:open="newOrderOpen" @created="openOrder" />
    </template>
  </UDashboardPanel>
</template>
