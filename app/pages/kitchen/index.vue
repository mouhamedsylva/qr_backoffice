<script setup lang="ts">
import { useDebounceFn, useFullscreen, useLocalStorage, useNow } from '@vueuse/core';
import { KitchenStationsModal } from '#components';
import type { KitchenItemStatus, KitchenTicket, Station } from '~/types/api';

useHead({ title: 'Cuisine · QR-Order' });

const api = useApi();
const restaurant = useRestaurantStore();
const realtime = useRealtime();
const overlay = useOverlay();
const alerts = useOrderAlerts();
const now = useNow({ interval: 15_000 });
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

const canManage = computed(() => restaurant.can('orders.manage'));
const stationsModal = overlay.create(KitchenStationsModal);

/** Poste affiché sur cet écran, mémorisé par appareil ('all' ou 'none' = sans poste). */
const station = useLocalStorage<string>('qro.kitchenStation', 'all');
const showReady = ref(false);
const locked = ref(false);

const { data: stations, refresh: refreshStations } = useAsyncData(
  'kitchen-stations',
  async () => {
    try {
      locked.value = false;
      return await api<Station[]>(`${restaurant.base}/kitchen/stations`, { silent: true });
    } catch (err) {
      locked.value = apiErrorCode(err) === 'FEATURE_NOT_IN_PLAN';
      return [];
    }
  },
  { default: () => [], watch: [() => restaurant.id] },
);

const { data: tickets, status, refresh } = useAsyncData(
  'kitchen-tickets',
  async () => {
    if (locked.value) return [];
    return api<KitchenTicket[]>(`${restaurant.base}/kitchen/tickets`, {
      query: { ...(station.value !== 'all' && { stationId: station.value }), ...(showReady.value && { includeReady: true }) },
      silent: true,
    }).catch(() => []);
  },
  { default: () => [], watch: [station, showReady, locked, () => restaurant.id] },
);

const stationTabs = computed(() => [
  { label: 'Tous les postes', value: 'all' },
  ...stations.value.filter((s) => s.isActive).map((s) => ({ label: s.name, value: s.id })),
  ...(stations.value.length ? [{ label: 'Sans poste', value: 'none' }] : []),
]);
// Poste supprimé entre-temps : retour à la vue globale.
watch(stations, (list) => {
  if (!['all', 'none'].includes(station.value) && !list.some((s) => s.id === station.value)) station.value = 'all';
});

// Temps réel : rafraîchissement groupé, signal sonore à l'arrivée d'une commande acceptée.
const refreshSoon = useDebounceFn(() => refresh(), 400);
realtime.on('order.status_changed', (m) => {
  const p = m.payload as { status: string; previousStatus: string };
  if (p.status === 'ACCEPTED' && p.previousStatus === 'PENDING') alerts.chime();
  void refreshSoon();
});
realtime.on('order.items_added', () => {
  alerts.chime();
  void refreshSoon();
});
realtime.on('kitchen.item_updated', () => void refreshSoon());
realtime.on('order.created', () => void refreshSoon());

// Actions (mise à jour optimiste, puis resynchronisation).
const busy = ref<string | null>(null);

async function setItem(ticket: KitchenTicket, itemId: string, next: KitchenItemStatus) {
  const item = ticket.items.find((i) => i.id === itemId);
  if (item) item.kitchenStatus = next;
  try {
    await api(`${restaurant.base}/kitchen/items/${itemId}`, { method: 'PATCH', body: { status: next } });
  } finally {
    void refreshSoon();
  }
}

async function bump(ticket: KitchenTicket, to: 'IN_PROGRESS' | 'READY') {
  busy.value = ticket.orderId;
  try {
    await api(`${restaurant.base}/kitchen/orders/${ticket.orderId}/bump`, {
      method: 'POST',
      body: { status: to, ...(!['all', 'none'].includes(station.value) && { stationId: station.value }) },
    });
    await refresh();
  } catch {
    // erreur déjà notifiée
  } finally {
    busy.value = null;
  }
}

async function rush(ticket: KitchenTicket, isRush: boolean) {
  ticket.isRush = isRush;
  try {
    await api(`${restaurant.base}/kitchen/orders/${ticket.orderId}/rush`, { method: 'PATCH', body: { isRush } });
  } finally {
    void refreshSoon();
  }
}

async function manageStations() {
  if (await stationsModal.open({ stations: stations.value })) await refreshStations();
}

const late = computed(() => tickets.value.filter((t) => t.estimatedReadyAt && now.value.getTime() >= new Date(t.estimatedReadyAt).getTime()).length);
const portions = computed(() => tickets.value.reduce((s, t) => s + t.items.filter((i) => i.kitchenStatus !== 'READY').reduce((a, i) => a + i.quantity, 0), 0));
</script>

<template>
  <UDashboardPanel id="kitchen" :ui="{ body: 'bg-muted' }">
    <template #header>
      <UDashboardNavbar title="Cuisine">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #trailing>
          <UBadge v-if="tickets.length" color="kitchen" variant="subtle" :label="`${tickets.length} ticket(s) · ${portions} portion(s)`" />
          <UBadge v-if="late" color="error" variant="solid" :label="`${late} en retard`" />
        </template>
        <template #right>
          <UButton
            v-if="restaurant.can('menu.manage') && !locked"
            color="neutral"
            variant="ghost"
            icon="i-lucide-settings-2"
            label="Postes"
            class="hidden sm:inline-flex"
            @click="manageStations"
          />
          <UButton
            color="neutral"
            variant="outline"
            :icon="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
            :aria-label="isFullscreen ? 'Quitter le plein écran' : 'Plein écran'"
            @click="toggleFullscreen"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar v-if="!locked">
        <template #left>
          <UTabs v-if="stationTabs.length > 1" v-model="station" :items="stationTabs" :content="false" variant="pill" size="sm" />
        </template>
        <template #right>
          <USwitch v-model="showReady" size="sm" label="Afficher les plats prêts" />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <UCard v-if="locked" class="mx-auto max-w-xl bg-gradient-to-br from-primary/10 to-transparent">
        <div class="flex items-start gap-3">
          <UIcon name="i-lucide-chef-hat" class="mt-0.5 size-7 text-primary" />
          <div>
            <p class="font-semibold text-highlighted">L'écran cuisine est inclus dans le forfait Premium</p>
            <p class="mt-1 text-sm text-muted">
              Tickets en temps réel par poste (grill, froid, bar…), avancement plat par plat, alertes de retard et commandes prioritaires.
              En attendant, la cuisine peut suivre les commandes depuis la page Commandes.
            </p>
            <UButton to="/orders" class="mt-3" variant="soft" icon="i-lucide-receipt-text" label="Voir les commandes" />
          </div>
        </div>
      </UCard>

      <div v-else-if="status === 'pending' && !tickets.length" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <USkeleton v-for="n in 4" :key="n" class="h-72 rounded-xl" />
      </div>

      <UEmpty
        v-else-if="!tickets.length"
        icon="i-lucide-cooking-pot"
        title="Rien à préparer"
        description="Les commandes acceptées apparaissent ici instantanément, avec un signal sonore."
        variant="naked"
        class="py-20"
      />

      <!-- Les tickets se placent en colonnes, du plus urgent au plus récent -->
      <div v-else class="columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
        <KitchenTicketCard
          v-for="t in tickets"
          :key="t.orderId"
          :ticket="t"
          :now="now.getTime()"
          :can-manage="canManage"
          :busy="busy === t.orderId"
          @item="(id, s) => setItem(t, id, s)"
          @bump="(s) => bump(t, s)"
          @rush="(r) => rush(t, r)"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
