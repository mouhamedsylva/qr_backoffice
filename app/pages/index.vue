<script setup lang="ts">
import { useDebounceFn, useNow } from '@vueuse/core';
import type { AnalyticsOverview, Dashboard } from '~/types/api';
import { MODE_LABEL, MODE_UI, orderWhere } from '~/utils/order-status';

useHead({ title: 'Tableau de bord · QR-Order' });

const api = useApi();
const auth = useAuthStore();
const restaurant = useRestaurantStore();
const orders = useOrdersStore();
const realtime = useRealtime();
const { money, time } = useMoney();
const now = useNow({ interval: 30_000 });

// Le staff n'a pas accès aux chiffres : direction les commandes.
if (restaurant.membership?.staffProfile === 'CUISINE' && restaurant.can('orders.view')) await navigateTo('/kitchen', { replace: true });
else if (!restaurant.can('dashboard.view')) await navigateTo('/orders', { replace: true });

const { data: today, pending, refresh: refreshToday } = await useAsyncData(
  'dashboard',
  () => api<Dashboard>(`${restaurant.base}/dashboard`),
  { watch: [() => restaurant.id] },
);

// Analytics : inclus à partir du forfait Pro (sinon 403 FEATURE_NOT_IN_PLAN).
const analyticsLocked = ref(false);
const { data: overview, refresh: refreshOverview } = await useAsyncData(
  'dashboard-overview',
  async () => {
    if (!restaurant.can('reports.view')) return null;
    try {
      analyticsLocked.value = false;
      return await api<AnalyticsOverview>(`${restaurant.base}/analytics/overview`, { silent: true });
    } catch (err) {
      analyticsLocked.value = apiErrorCode(err) === 'FEATURE_NOT_IN_PLAN';
      return null;
    }
  },
  { watch: [() => restaurant.id] },
);

// Chiffres mis à jour en direct, regroupés pour éviter les rafales d'appels.
const refreshAll = useDebounceFn(() => Promise.all([refreshToday(), refreshOverview()]), 1500);
realtime.on('order.created', refreshAll);
realtime.on('order.status_changed', refreshAll);
realtime.on('order.payment_updated', refreshAll);
realtime.on('table.updated', refreshAll);

const greeting = computed(() => {
  const hour = Number(
    new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hour12: false, timeZone: restaurant.timezone }).format(
      now.value,
    ),
  );
  return hour < 18 ? 'Bonjour' : 'Bonsoir';
});

const todayLabel = computed(() =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: restaurant.timezone }).format(
    now.value,
  ),
);

const daily = computed(() =>
  (overview.value?.daily ?? []).map((d) => ({
    jour: d.date.slice(8, 10) + '/' + d.date.slice(5, 7),
    revenue: d.revenue,
    orders: d.orders,
  })),
);

const peakHours = computed(() =>
  (overview.value?.peakHours ?? [])
    .filter((h) => h.hour >= 6)
    .map((h) => ({ heure: `${h.hour}h`, orders: h.orders })),
);

const byMode = computed(() =>
  Object.entries(overview.value?.byMode ?? {}).map(([mode, v]) => ({
    mode: MODE_LABEL[mode as keyof typeof MODE_LABEL] ?? mode,
    revenue: v.revenue,
  })),
);
/** Part d'un mode dans le chiffre d'affaires de la période, en %. */
const modeShare = (revenue: number) => {
  const total = byMode.value.reduce((s, m) => s + m.revenue, 0);
  return total ? Math.round((revenue / total) * 100) : 0;
};

const recentOrders = computed(() =>
  [...orders.active]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6),
);
</script>

<template>
  <UDashboardPanel id="dashboard">
    <template #header>
      <UDashboardNavbar title="Tableau de bord">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UBadge
            v-if="today"
            :color="today.isOpen ? 'success' : 'neutral'"
            variant="subtle"
            :icon="today.isOpen ? 'i-lucide-door-open' : 'i-lucide-door-closed'"
            :label="today.isOpen ? 'Ouvert' : 'Fermé'"
          />
          <UButton icon="i-lucide-receipt-text" to="/orders" label="Commandes" class="hidden sm:inline-flex" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <div>
          <h1 class="font-display text-2xl font-semibold text-highlighted sm:text-3xl">
            {{ greeting }} {{ auth.user?.firstName }}
          </h1>
          <p class="text-muted first-letter:uppercase">{{ todayLabel }} · {{ restaurant.membership?.name }}</p>
        </div>

        <!-- Indicateurs du jour (RES-05) -->
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardKpiCard
            label="Chiffre d'affaires du jour"
            :value="money(today?.salesTotal ?? 0)"
            icon="i-lucide-banknote"
            :loading="pending && !today"
          />
          <DashboardKpiCard
            label="Commandes du jour"
            :value="String(today?.ordersCount ?? 0)"
            icon="i-lucide-receipt-text"
            :hint="
              today?.ordersByMode
                ? `${today.ordersByMode.DINE_IN} sur place · ${today.ordersByMode.TAKEAWAY} à emporter${today.ordersInProgress ? ` · ${today.ordersInProgress} en cours` : ''}`
                : today?.ordersInProgress
                  ? `${today.ordersInProgress} en cours`
                  : 'Aucune en cours'
            "
            :loading="pending && !today"
          />
          <DashboardKpiCard
            label="Panier moyen"
            :value="money(today?.averageBasket ?? 0)"
            icon="i-lucide-shopping-basket"
            :loading="pending && !today"
          />
          <DashboardKpiCard
            label="Tables occupées"
            :value="String(today?.tablesOccupied ?? 0)"
            icon="i-lucide-armchair"
            :loading="pending && !today"
          />
        </div>

        <!-- Analytics 30 jours -->
        <div v-if="overview" class="grid gap-4 xl:grid-cols-3">
          <UCard class="xl:col-span-2">
            <template #header>
              <div class="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p class="text-sm text-muted">Chiffre d'affaires · 30 derniers jours</p>
                  <p class="tabular text-2xl font-semibold text-highlighted">{{ money(overview.revenue) }}</p>
                </div>
                <UBadge
                  v-if="overview.comparison.revenueChange !== null"
                  :color="overview.comparison.revenueChange >= 0 ? 'success' : 'error'"
                  variant="subtle"
                  :label="`${formatChange(overview.comparison.revenueChange)} vs période précédente`"
                />
              </div>
            </template>
            <UChart
              type="area"
              :data="daily"
              index="jour"
              :categories="[{ key: 'revenue', label: 'Chiffre d\'affaires', color: 'var(--ui-primary)' }]"
              :format="(v: number) => money(v)"
              :height="260"
              :legend="false"
              aria-label="Chiffre d'affaires quotidien sur 30 jours"
            />
          </UCard>

          <div class="grid gap-4">
            <UCard>
              <template #header>
                <p class="text-sm text-muted">Heures de pointe</p>
              </template>
              <UChart
                type="bar"
                :data="peakHours"
                index="heure"
                :categories="[{ key: 'orders', label: 'Commandes', color: 'var(--color-safran-500)' }]"
                :height="150"
                :legend="false"
                :y-axis="false"
                aria-label="Nombre de commandes par heure"
              />
            </UCard>
            <UCard>
              <template #header>
                <p class="text-sm text-muted">Sur place / à emporter</p>
              </template>
              <UChart
                v-if="byMode.length"
                type="donut"
                :data="byMode"
                index="mode"
                :categories="['revenue']"
                :colors="['var(--ui-primary)', 'var(--color-safran-400)']"
                :format="(v: number) => money(v)"
                :height="150"
                aria-label="Répartition du chiffre d'affaires par mode"
              />
              <ul v-if="byMode.length" class="mt-3 space-y-1.5 text-sm">
                <li v-for="(m, i) in byMode" :key="m.mode" class="flex items-center gap-2">
                  <span class="size-2.5 shrink-0 rounded-full" :class="i === 0 ? 'bg-primary' : 'bg-safran-400'" />
                  <span class="flex-1">{{ m.mode }}</span>
                  <span class="tabular text-muted">{{ modeShare(m.revenue) }} %</span>
                  <span class="tabular font-medium">{{ money(m.revenue) }}</span>
                </li>
              </ul>
              <p v-else class="text-sm text-muted">Pas encore de ventes sur la période.</p>
            </UCard>
          </div>
        </div>

        <UCard v-else-if="analyticsLocked" class="bg-gradient-to-br from-primary/10 to-transparent">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-start gap-3">
              <UIcon name="i-lucide-chart-line" class="mt-0.5 size-6 text-primary" />
              <div>
                <p class="font-semibold text-highlighted">Suivez votre activité sur 30 jours</p>
                <p class="text-sm text-muted">
                  Courbe du chiffre d'affaires, heures de pointe et comparaison des périodes : inclus dans le forfait Pro.
                </p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Commandes en cours -->
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex items-center justify-between">
              <p class="font-semibold text-highlighted">Commandes en cours</p>
              <UButton to="/orders" variant="link" color="neutral" trailing-icon="i-lucide-arrow-right" label="Tout voir" />
            </div>
          </template>
          <UEmpty
            v-if="!recentOrders.length"
            icon="i-lucide-coffee"
            title="Aucune commande en cours"
            description="Les nouvelles commandes apparaîtront ici en temps réel."
            variant="naked"
            class="py-10"
          />
          <ul v-else class="divide-y divide-default">
            <li v-for="order in recentOrders" :key="order.id">
              <NuxtLink
                :to="{ path: '/orders', query: { order: order.id } }"
                class="flex items-center gap-4 px-4 py-3 transition hover:bg-elevated/60 sm:px-6"
              >
                <span class="tabular w-14 font-display text-lg font-semibold text-highlighted">n°{{ order.number }}</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm text-default">
                    <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold" :class="MODE_UI[order.mode].badge">
                      <UIcon :name="MODE_UI[order.mode].icon" class="size-3" />{{ orderWhere(order) }}
                    </span>
                    <span v-if="order.customerName" class="text-muted">· {{ order.customerName }}</span>
                  </span>
                  <span class="block text-xs text-muted">{{ time(order.createdAt) }} · {{ formatAge(order.createdAt, now.getTime()) }}</span>
                </span>
                <OrdersStatusBadge :status="order.status" />
                <span class="tabular hidden w-28 text-right font-medium sm:block">{{ money(order.total, order.currency) }}</span>
              </NuxtLink>
            </li>
          </ul>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
