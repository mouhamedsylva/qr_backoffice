<script setup lang="ts">
/** Activité sur la période : chiffres clés comparés, courbe, heures de pointe, modes (ANA-01). */
import type { AnalyticsOverview } from '~/types/api';
import { MODE_LABEL } from '~/utils/order-status';

const props = defineProps<{ data: AnalyticsOverview | null; loading: boolean }>();
const { money } = useMoney();

const days = computed(() => props.data?.daily.length ?? 0);
const daily = computed(() =>
  (props.data?.daily ?? []).map((d) => ({ jour: `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`, revenue: d.revenue, orders: d.orders })),
);
const peakHours = computed(() =>
  (props.data?.peakHours ?? []).filter((h) => h.hour >= 6 || h.orders > 0).map((h) => ({ heure: `${h.hour}h`, orders: h.orders, revenue: h.revenue })),
);
const byMode = computed(() =>
  Object.entries(props.data?.byMode ?? {}).map(([mode, v]) => ({ mode: MODE_LABEL[mode as keyof typeof MODE_LABEL] ?? mode, revenue: v.revenue, orders: v.orders })),
);
const bestDay = computed(() => [...(props.data?.daily ?? [])].sort((a, b) => b.revenue - a.revenue)[0]);
const bestHour = computed(() => [...(props.data?.peakHours ?? [])].sort((a, b) => b.orders - a.orders)[0]);
const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardKpiCard label="Chiffre d'affaires" :value="money(data?.revenue ?? 0)" icon="i-lucide-banknote" :change="data?.comparison.revenueChange ?? undefined" :loading="loading && !data" />
      <DashboardKpiCard label="Commandes" :value="(data?.orders ?? 0).toLocaleString('fr-FR')" icon="i-lucide-receipt-text" :change="data?.comparison.ordersChange ?? undefined" :loading="loading && !data" />
      <DashboardKpiCard label="Panier moyen" :value="money(data?.averageBasket ?? 0)" icon="i-lucide-shopping-basket" :change="data?.comparison.averageBasketChange ?? undefined" :loading="loading && !data" />
      <DashboardKpiCard
        label="Annulations"
        :value="`${(data?.cancellationRate ?? 0).toLocaleString('fr-FR')} %`"
        icon="i-lucide-ban"
        :hint="`${data?.cancelledOrders ?? 0} commande(s) annulée(s) ou refusée(s)`"
        :loading="loading && !data"
      />
    </div>
    <p class="text-xs text-muted">Évolution comparée à la période précédente de même durée.</p>

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-end justify-between gap-2">
          <p class="font-semibold text-highlighted">Chiffre d'affaires par jour</p>
          <p v-if="bestDay && bestDay.revenue" class="text-sm text-muted">
            Meilleur jour : <span class="text-default first-letter:uppercase">{{ dateLabel(bestDay.date) }}</span> · {{ money(bestDay.revenue) }}
          </p>
        </div>
      </template>
      <USkeleton v-if="loading && !data" class="h-72 w-full" />
      <UChart
        v-else
        :type="days > 45 ? 'line' : 'area'"
        :data="daily"
        index="jour"
        :categories="[{ key: 'revenue', label: 'Chiffre d\'affaires', color: 'var(--ui-primary)' }]"
        :format="(v: number) => money(v)"
        :height="280"
        :legend="false"
        aria-label="Chiffre d'affaires quotidien"
      />
    </UCard>

    <div class="grid gap-4 lg:grid-cols-3">
      <UCard class="lg:col-span-2">
        <template #header>
          <div class="flex flex-wrap items-end justify-between gap-2">
            <p class="font-semibold text-highlighted">Heures de pointe</p>
            <p v-if="bestHour && bestHour.orders" class="text-sm text-muted">Pic à {{ bestHour.hour }}h · {{ bestHour.orders }} commandes</p>
          </div>
        </template>
        <UChart
          type="bar"
          :data="peakHours"
          index="heure"
          :categories="[{ key: 'orders', label: 'Commandes', color: 'var(--color-safran-500)' }]"
          :height="220"
          :legend="false"
          aria-label="Commandes par heure"
        />
      </UCard>
      <UCard>
        <template #header>
          <p class="font-semibold text-highlighted">Sur place / à emporter</p>
        </template>
        <UChart
          v-if="byMode.some((m) => m.revenue)"
          type="donut"
          :data="byMode"
          index="mode"
          :categories="['revenue']"
          :colors="['var(--ui-primary)', 'var(--color-safran-400)']"
          :format="(v: number) => money(v)"
          :height="180"
          aria-label="Chiffre d'affaires par mode"
        />
        <p v-else class="py-10 text-center text-sm text-muted">Pas de vente sur la période.</p>
        <ul class="mt-3 space-y-1 text-sm">
          <li v-for="m in byMode" :key="m.mode" class="flex justify-between">
            <span class="text-muted">{{ m.mode }}</span>
            <span class="tabular">{{ m.orders }} cmd · {{ money(m.revenue) }}</span>
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>
