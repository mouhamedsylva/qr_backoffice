<script setup lang="ts">
/** Rapport de TVA par jour ou par mois, pour la comptabilité (ANA-03). */
import type { TaxReport } from '~/types/api';

defineProps<{ data: TaxReport | null; loading: boolean }>();
const groupBy = defineModel<'day' | 'month'>('groupBy', { default: 'day' });
const { money } = useMoney();

const periodLabel = (p: string, g: 'day' | 'month') =>
  g === 'month'
    ? new Date(`${p}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : new Date(`${p}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardKpiCard label="Total TTC encaissé" :value="money(data?.totals.totalInclTax ?? 0)" icon="i-lucide-banknote" :loading="loading && !data" />
      <DashboardKpiCard label="Base HT" :value="money(data?.totals.baseAmount ?? 0)" icon="i-lucide-calculator" :loading="loading && !data" />
      <DashboardKpiCard label="TVA collectée" :value="money(data?.totals.taxAmount ?? 0)" icon="i-lucide-landmark" :loading="loading && !data" />
      <DashboardKpiCard
        label="Remboursements"
        :value="money(data?.totals.refunds ?? 0)"
        icon="i-lucide-undo-2"
        :hint="`Service ${money(data?.totals.serviceFees ?? 0)} · pourboires ${money(data?.totals.tips ?? 0)}`"
        :loading="loading && !data"
      />
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-semibold text-highlighted">Détail</p>
          <UTabs
            v-model="groupBy"
            :items="[
              { label: 'Par jour', value: 'day' },
              { label: 'Par mois', value: 'month' },
            ]"
            :content="false"
            size="xs"
          />
        </div>
      </template>
      <USkeleton v-if="loading && !data" class="m-4 h-48" />
      <p v-else-if="!data?.lines.length" class="py-10 text-center text-sm text-muted">Aucune commande payée sur la période.</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-b border-default text-left text-xs text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">Période</th>
              <th class="px-4 py-2 text-right font-medium">Taux</th>
              <th class="px-4 py-2 text-right font-medium">Commandes</th>
              <th class="px-4 py-2 text-right font-medium">Base HT</th>
              <th class="px-4 py-2 text-right font-medium">TVA</th>
              <th class="px-4 py-2 text-right font-medium">Total TTC</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="l in data.lines" :key="`${l.period}-${l.taxRateBp}`">
              <td class="px-4 py-2 first-letter:uppercase">{{ periodLabel(l.period, data.groupBy) }}</td>
              <td class="tabular px-4 py-2 text-right">{{ l.taxRateBp / 100 }} %</td>
              <td class="tabular px-4 py-2 text-right">{{ l.orders }}</td>
              <td class="tabular px-4 py-2 text-right">{{ money(l.baseAmount) }}</td>
              <td class="tabular px-4 py-2 text-right">{{ money(l.taxAmount) }}</td>
              <td class="tabular px-4 py-2 text-right font-medium">{{ money(l.totalInclTax) }}</td>
            </tr>
          </tbody>
          <tfoot class="border-t-2 border-default font-semibold text-highlighted">
            <tr>
              <td class="px-4 py-2" colspan="2">Total</td>
              <td class="tabular px-4 py-2 text-right">{{ data.totals.orders }}</td>
              <td class="tabular px-4 py-2 text-right">{{ money(data.totals.baseAmount) }}</td>
              <td class="tabular px-4 py-2 text-right">{{ money(data.totals.taxAmount) }}</td>
              <td class="tabular px-4 py-2 text-right">{{ money(data.totals.totalInclTax) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </UCard>
    <p class="text-xs text-muted">
      Montants des commandes payées, calculés avec le taux en vigueur au moment de chaque commande. À transmettre à votre comptable avec l'export CSV.
    </p>
  </div>
</template>
