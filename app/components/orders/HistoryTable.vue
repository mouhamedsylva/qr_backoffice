<script setup lang="ts">
/** Historique paginé des commandes, avec filtres et export CSV. */
import type { TableColumn } from '@nuxt/ui';
import { refDebounced } from '@vueuse/core';
import type { Order, OrderMode, Paginated, PaymentStatus } from '~/types/api';
import { MODE_LABEL, MODE_UI, ORDER_STATUS, orderWhere, PAYMENT_STATUS, type OrderStatus } from '~/utils/order-status';

const emit = defineEmits<{ open: [order: Order] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const toast = useToast();
const { money, dateTime } = useMoney();

const page = ref(1);
const limit = 20;
const status = ref<OrderStatus[]>([]);
const mode = ref<OrderMode | 'ALL'>('ALL');
const paymentStatus = ref<PaymentStatus | 'ALL'>('ALL');
const from = ref('');
const to = ref('');
const search = ref('');
const searchDebounced = refDebounced(search, 350);

const statusItems = (Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => ({ label: ORDER_STATUS[s].label, value: s }));
const modeItems = [
  { label: 'Tous les modes', value: 'ALL' },
  { label: MODE_LABEL.DINE_IN, value: 'DINE_IN' },
  { label: MODE_LABEL.TAKEAWAY, value: 'TAKEAWAY' },
];
const paymentItems = [
  { label: 'Tous les paiements', value: 'ALL' },
  ...Object.entries(PAYMENT_STATUS).map(([value, meta]) => ({ label: meta!.label, value })),
];

/** Bornes de dates saisies (jour local) converties en instants ISO. */
const filters = computed(() => ({
  ...(status.value.length && { status: status.value.join(',') }),
  ...(mode.value !== 'ALL' && { mode: mode.value }),
  ...(paymentStatus.value !== 'ALL' && { paymentStatus: paymentStatus.value }),
  ...(from.value && { from: new Date(`${from.value}T00:00:00`).toISOString() }),
  ...(to.value && { to: new Date(`${to.value}T23:59:59.999`).toISOString() }),
  ...(searchDebounced.value.trim() && { search: searchDebounced.value.trim() }),
}));

// Tout changement de filtre ramène à la première page.
watch(filters, () => (page.value = 1));

// Sans `await` : le tableau s'affiche tout de suite avec son état de chargement.
const { data, status: fetchStatus, refresh } = useAsyncData(
  'orders-history',
  () =>
    api<Paginated<Order>>(`${restaurant.base}/orders`, {
      query: { ...filters.value, page: page.value, limit },
    }),
  { watch: [filters, page, () => restaurant.id] },
);

defineExpose({ refresh });

const hasFilters = computed(() => Object.keys(filters.value).length > 0);
function clearFilters() {
  status.value = [];
  mode.value = 'ALL';
  paymentStatus.value = 'ALL';
  from.value = '';
  to.value = '';
  search.value = '';
}

const exporting = ref(false);
async function exportCsv() {
  exporting.value = true;
  try {
    const blob = await api<Blob>(`${restaurant.base}/orders/export.csv`, {
      query: filters.value,
      responseType: 'blob',
    });
    const day = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `commandes-${restaurant.membership?.slug ?? 'restaurant'}-${day}.csv`);
    toast.add({ title: 'Export prêt', description: 'Le fichier CSV a été téléchargé.', color: 'success', icon: 'i-lucide-download' });
  } catch {
    // erreur déjà notifiée
  } finally {
    exporting.value = false;
  }
}

const columns: TableColumn<Order>[] = [
  { accessorKey: 'number', header: 'N°' },
  { accessorKey: 'createdAt', header: 'Date' },
  { id: 'where', header: 'Mode' },
  { accessorKey: 'customerName', header: 'Client' },
  { accessorKey: 'status', header: 'Statut' },
  { accessorKey: 'paymentStatus', header: 'Paiement' },
  { accessorKey: 'total', header: () => h('span', { class: 'block text-right' }, 'Total') },
];
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <UInput v-model="search" icon="i-lucide-search" placeholder="N° ou client…" class="w-full sm:w-52" />
      <USelectMenu
        v-model="status"
        multiple
        :items="statusItems"
        value-key="value"
        placeholder="Tous les statuts"
        :search-input="false"
        class="w-full sm:w-48"
      />
      <USelect v-model="mode" :items="modeItems" class="w-full sm:w-40" />
      <USelect v-model="paymentStatus" :items="paymentItems" class="w-full sm:w-48" />
      <div class="flex items-center gap-1">
        <UInput v-model="from" type="date" aria-label="Du" class="w-36" />
        <span class="text-muted">→</span>
        <UInput v-model="to" type="date" aria-label="Au" class="w-36" />
      </div>
      <UButton v-if="hasFilters" color="neutral" variant="link" icon="i-lucide-x" label="Effacer" @click="clearFilters" />
      <div class="ms-auto">
        <UButton
          v-if="restaurant.can('orders.view')"
          color="neutral"
          variant="outline"
          icon="i-lucide-download"
          label="Exporter CSV"
          :loading="exporting"
          @click="exportCsv"
        />
      </div>
    </div>

    <UTable
      :data="data?.data ?? []"
      :columns="columns"
      :loading="fetchStatus === 'pending'"
      sticky
      class="rounded-lg border border-default"
      :ui="{ tr: 'cursor-pointer', td: 'py-2.5' }"
      @select="(_e: Event, row) => emit('open', row.original)"
    >
      <template #number-cell="{ row }">
        <span class="tabular font-semibold text-highlighted">n°{{ row.original.number }}</span>
      </template>
      <template #createdAt-cell="{ row }">
        <span class="tabular text-sm">{{ dateTime(row.original.createdAt) }}</span>
      </template>
      <template #where-cell="{ row }">
        <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" :class="MODE_UI[row.original.mode].badge">
          <UIcon :name="MODE_UI[row.original.mode].icon" class="size-3.5" />{{ orderWhere(row.original) }}
        </span>
      </template>
      <template #customerName-cell="{ row }">
        <span :class="row.original.customerName ? '' : 'text-dimmed'">{{ row.original.customerName ?? '—' }}</span>
      </template>
      <template #status-cell="{ row }">
        <OrdersStatusBadge :status="row.original.status" />
      </template>
      <template #paymentStatus-cell="{ row }">
        <UBadge
          :color="PAYMENT_STATUS[row.original.paymentStatus]?.color"
          variant="subtle"
          :label="PAYMENT_STATUS[row.original.paymentStatus]?.label"
        />
      </template>
      <template #total-cell="{ row }">
        <span class="tabular block text-right font-medium">{{ money(row.original.total, row.original.currency) }}</span>
      </template>
      <template #empty>
        <UEmpty
          icon="i-lucide-receipt-text"
          :title="hasFilters ? 'Aucune commande ne correspond' : 'Aucune commande pour l\'instant'"
          :description="hasFilters ? 'Essayez d\'élargir les filtres.' : 'Les commandes passées apparaîtront ici.'"
          variant="naked"
        />
      </template>
    </UTable>

    <div v-if="data && data.meta.total > limit" class="flex items-center justify-between gap-2">
      <p class="text-sm text-muted">{{ data.meta.total }} commandes</p>
      <UPagination v-model:page="page" :total="data.meta.total" :items-per-page="limit" />
    </div>
  </div>
</template>
