<script setup lang="ts">
/** Performance du menu : meilleures ventes, plats délaissés, marges (ANA-02). */
import type { TableColumn } from '@nuxt/ui';
import type { MenuPerformance, MenuPerformanceRow } from '~/types/api';

const props = defineProps<{ data: MenuPerformance | null; loading: boolean }>();
const { money } = useMoney();

const blocks = computed(() => [
  { title: 'Meilleures ventes', icon: 'i-lucide-trophy', list: props.data?.bestSellers ?? [], kind: 'best' },
  { title: 'Les moins vendus', icon: 'i-lucide-trending-down', list: props.data?.leastSold ?? [], kind: 'least' },
  { title: 'Marges les plus faibles', icon: 'i-lucide-scale', list: props.data?.lowestMargin ?? [], kind: 'margin' },
]);

const search = ref('');
const sorting = ref([{ id: 'revenue', desc: true }]);
const rows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return (props.data?.items ?? []).filter((r) => !q || `${r.name} ${r.category}`.toLowerCase().includes(q));
});
const totalRevenue = computed(() => (props.data?.items ?? []).reduce((s, r) => s + r.revenue, 0));
const share = (r: MenuPerformanceRow) => (totalRevenue.value ? (r.revenue / totalRevenue.value) * 100 : 0);

const sortHeader = (label: string, right = false) => ({ column }: { column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean) => void } }) =>
  h('button', {
    type: 'button',
    class: ['inline-flex items-center gap-1 font-semibold', right && 'w-full justify-end'],
    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
  }, [label, column.getIsSorted() ? (column.getIsSorted() === 'asc' ? ' ↑' : ' ↓') : '']);

const columns: TableColumn<MenuPerformanceRow>[] = [
  { accessorKey: 'name', header: sortHeader('Article') },
  { accessorKey: 'category', header: sortHeader('Catégorie') },
  { accessorKey: 'quantity', header: sortHeader('Vendus', true) },
  { accessorKey: 'revenue', header: sortHeader('Chiffre d\'affaires', true) },
  { accessorKey: 'marginRate', header: sortHeader('Marge', true), sortUndefined: 'last' },
];

const marginColor = (rate: number | null) => (rate === null ? 'text-dimmed' : rate < 50 ? 'text-error' : rate < 65 ? 'text-warning' : 'text-success');
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 lg:grid-cols-3">
      <UCard v-for="block in blocks" :key="block.kind">
        <template #header>
          <p class="flex items-center gap-2 font-semibold text-highlighted"><UIcon :name="block.icon" class="text-primary" /> {{ block.title }}</p>
        </template>
        <USkeleton v-if="loading && !data" class="h-40 w-full" />
        <p v-else-if="!block.list.length" class="text-sm text-muted">
          {{ block.kind === 'margin' ? 'Renseignez le coût de revient de vos plats pour suivre les marges.' : 'Pas de données.' }}
        </p>
        <ol v-else class="space-y-2">
          <li v-for="(r, i) in block.list.slice(0, 5)" :key="r.menuItemId" class="flex items-center gap-2 text-sm">
            <span class="tabular w-4 text-muted">{{ i + 1 }}</span>
            <span class="min-w-0 flex-1 truncate">{{ r.name }}</span>
            <span v-if="block.kind === 'margin'" class="tabular font-medium" :class="marginColor(r.marginRate)">{{ r.marginRate }} %</span>
            <span v-else class="tabular font-medium">{{ r.quantity }} vendu{{ r.quantity > 1 ? 's' : '' }}</span>
          </li>
        </ol>
      </UCard>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-semibold text-highlighted">Tous les articles</p>
          <UInput v-model="search" icon="i-lucide-search" placeholder="Rechercher…" size="sm" class="w-56" />
        </div>
      </template>
      <UTable v-model:sorting="sorting" :data="rows" :columns="columns" :loading="loading" sticky class="max-h-[32rem]">
        <template #name-cell="{ row }">
          <span class="font-medium" :class="!row.original.active && 'text-dimmed line-through'">{{ row.original.name }}</span>
        </template>
        <template #quantity-cell="{ row }">
          <span class="tabular block text-right">{{ row.original.quantity }}</span>
        </template>
        <template #revenue-cell="{ row }">
          <div class="flex items-center justify-end gap-2">
            <div class="hidden h-1.5 w-16 overflow-hidden rounded-full bg-elevated sm:block">
              <div class="h-full rounded-full bg-primary" :style="{ width: `${share(row.original)}%` }" />
            </div>
            <span class="tabular">{{ money(row.original.revenue) }}</span>
          </div>
        </template>
        <template #marginRate-cell="{ row }">
          <span class="tabular block text-right font-medium" :class="marginColor(row.original.marginRate)">
            {{ row.original.marginRate === null ? '—' : `${row.original.marginRate} %` }}
          </span>
        </template>
        <template #empty>
          <p class="py-8 text-center text-sm text-muted">Aucun article.</p>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
