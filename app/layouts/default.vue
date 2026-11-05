<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';
import type { Order } from '~/types/api';

const restaurant = useRestaurantStore();
const orders = useOrdersStore();
const realtime = useRealtime();
const alerts = useOrderAlerts();
const toast = useToast();
const { money } = useMoney();
const route = useRoute();

const open = ref(false);

const links = computed<NavigationMenuItem[][]>(() => [
  [
    { label: 'Tableau de bord', icon: 'i-lucide-layout-dashboard', to: '/', perm: 'dashboard.view' },
    {
      label: 'Commandes',
      icon: 'i-lucide-receipt-text',
      to: '/orders',
      perm: 'orders.view',
      badge: orders.pendingCount ? { label: String(orders.pendingCount), color: 'warning' as const } : undefined,
    },
    { label: 'Menu', icon: 'i-lucide-book-open', to: '/menu', perm: 'menu.view' },
    { label: 'Tables & QR', icon: 'i-lucide-qr-code', to: '/tables', perm: 'tables.view' },
    { label: 'Cuisine', icon: 'i-lucide-chef-hat', to: '/kitchen', perm: 'orders.view' },
    { label: 'Analytics', icon: 'i-lucide-chart-column', to: '/analytics', perm: 'reports.view' },
    { label: 'Promotions & fidélité', icon: 'i-lucide-gift', to: '/promotions', perm: 'marketing.manage' },
    { label: 'Avis clients', icon: 'i-lucide-star', to: '/reviews', perm: 'reviews.manage' },
    { label: 'Équipe', icon: 'i-lucide-users', to: '/team', perm: 'team.view' },
    { label: 'Réglages', icon: 'i-lucide-settings', to: '/settings', perm: 'restaurant.view' },
  ]
    .filter((l) => restaurant.can(l.perm))
    .map(({ perm: _perm, ...l }) => ({ ...l, onSelect: () => (open.value = false) })),
]);

const searchGroups = computed(() => [
  {
    id: 'pages',
    label: 'Pages',
    items: links.value[0]!.map((l) => ({ label: l.label, icon: l.icon, to: l.to })),
  },
  {
    id: 'orders',
    label: 'Commandes en cours',
    items: orders.active.map((o) => ({
      label: `Commande n°${o.number}`,
      suffix: o.table ? `Table ${o.table.label}` : 'À emporter',
      icon: 'i-lucide-receipt-text',
      to: { path: '/orders', query: { order: o.id } },
    })),
  },
]);

// Temps réel : une connexion par restaurant actif.
watch(
  () => restaurant.id,
  async (id) => {
    if (!id) return;
    realtime.connect(id);
    await orders.load(true);
  },
  { immediate: true },
);

realtime.on('*', (message) => {
  const isNew = orders.apply(message);
  if (isNew && route.path !== '/orders') alerts.unread.value++;
  if (isNew) {
    const order = message.payload as Order;
    alerts.chime();
    toast.add({
      title: `Nouvelle commande n°${order.number}`,
      description: `${order.table ? `Table ${order.table.label}` : 'À emporter'} · ${money(order.total, order.currency)}`,
      icon: 'i-lucide-bell-ring',
      color: 'warning',
      actions: [{ label: 'Voir', to: { path: '/orders', query: { order: order.id } } }],
    });
  }
});
</script>

<template>
  <UDashboardGroup unit="rem" storage="local" storage-key="qro-dashboard">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/40"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <LayoutRestaurantSwitcher :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" label="Rechercher…" class="bg-transparent ring-default" />

        <UNavigationMenu :collapsed="collapsed" :items="links[0]" orientation="vertical" tooltip popover />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[1]"
          orientation="vertical"
          tooltip
          class="mt-auto opacity-80"
        />
      </template>

      <template #footer="{ collapsed }">
        <LayoutUserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="searchGroups" placeholder="Rechercher une page ou une commande…" />

    <slot />
  </UDashboardGroup>
</template>
