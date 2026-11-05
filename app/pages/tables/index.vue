<script setup lang="ts">
import { useNow } from '@vueuse/core';
import type { DropdownMenuItem } from '@nuxt/ui';
import { ConfirmModal, TablesQrModal, TablesTableFormModal, TablesZoneFormModal } from '#components';
import type { DiningTable, TableStatus, Zone } from '~/types/api';
import { TABLE_STATUS, type StatusColor } from '~/utils/order-status';

useHead({ title: 'Tables & QR · QR-Order' });

const api = useApi();
const restaurant = useRestaurantStore();
const realtime = useRealtime();
const toast = useToast();
const overlay = useOverlay();
const now = useNow({ interval: 30_000 });

const canManage = computed(() => restaurant.can('tables.manage'));
const canStatus = computed(() => restaurant.can('tables.status'));
const tableModal = overlay.create(TablesTableFormModal);
const zoneModal = overlay.create(TablesZoneFormModal);
const qrModal = overlay.create(TablesQrModal);
const confirmModal = overlay.create(ConfirmModal);

const { data, status, refresh } = await useAsyncData(
  'tables',
  async () => {
    const [zones, tables] = await Promise.all([
      api<Zone[]>(`${restaurant.base}/zones`),
      api<DiningTable[]>(`${restaurant.base}/tables`),
    ]);
    return { zones, tables };
  },
  { default: () => ({ zones: [] as Zone[], tables: [] as DiningTable[] }), watch: [() => restaurant.id] },
);

const zone = ref<string>('all');
const statusFilter = ref<TableStatus | null>(null);
const zoneTabs = computed(() => [
  { label: 'Toutes', value: 'all', badge: data.value.tables.length },
  ...data.value.zones.map((z) => ({ label: z.name, value: z.id, badge: data.value.tables.filter((t) => t.zone?.id === z.id).length })),
  ...(data.value.tables.some((t) => !t.zone) && data.value.zones.length
    ? [{ label: 'Sans zone', value: 'none', badge: data.value.tables.filter((t) => !t.zone).length }]
    : []),
]);
const currentZone = computed(() => data.value.zones.find((z) => z.id === zone.value) ?? null);

const inZone = computed(() =>
  data.value.tables.filter((t) => (zone.value === 'all' ? true : zone.value === 'none' ? !t.zone : t.zone?.id === zone.value)),
);
const visible = computed(() => inZone.value.filter((t) => !statusFilter.value || t.status === statusFilter.value));

const summary = computed(() =>
  (Object.keys(TABLE_STATUS) as TableStatus[])
    .map((s) => ({ status: s, count: inZone.value.filter((t) => t.status === s).length }))
    .filter((s) => s.count),
);

// Couleurs écrites en toutes lettres pour Tailwind.
const TILE: Record<StatusColor, string> = {
  success: 'border-success/40 bg-success/5',
  info: 'border-info/50 bg-info/10',
  kitchen: 'border-kitchen/50 bg-kitchen/10',
  warning: 'border-warning/60 bg-warning/15 ring-2 ring-warning/30',
  neutral: 'border-default bg-elevated',
  error: 'border-error/40 bg-error/5',
};
const DOT: Record<StatusColor, string> = {
  success: 'bg-success',
  info: 'bg-info',
  kitchen: 'bg-kitchen',
  warning: 'bg-warning animate-pulse',
  neutral: 'bg-inverted/40',
  error: 'bg-error',
};
const colorOf = (s: TableStatus) => TABLE_STATUS[s]!.color;

async function setStatus(table: DiningTable, next: TableStatus) {
  const previous = table.status;
  table.status = next; // affichage immédiat
  try {
    const updated = await api<DiningTable>(`${restaurant.base}/tables/${table.id}/status`, { method: 'PATCH', body: { status: next } });
    Object.assign(table, updated);
  } catch {
    table.status = previous;
  }
}

async function openTable(table: DiningTable | null) {
  const saved = await tableModal.open({
    table,
    zones: data.value.zones,
    defaultZoneId: currentZone.value?.id ?? null,
  });
  if (saved) await refresh();
}

async function openZone(z: Zone | null) {
  const saved = await zoneModal.open({ zone: z });
  if (saved) {
    await refresh();
    zone.value = saved.id;
  }
}

async function removeZone(z: Zone) {
  const ok = await confirmModal.open({
    title: `Supprimer la zone « ${z.name} » ?`,
    description: 'Ses tables sont conservées et passent « sans zone ».',
    confirmLabel: 'Supprimer',
  });
  if (!ok) return;
  try {
    await api(`${restaurant.base}/zones/${z.id}`, { method: 'DELETE' });
    zone.value = 'all';
    await refresh();
  } catch {
    // erreur déjà notifiée
  }
}

async function removeTable(table: DiningTable) {
  const ok = await confirmModal.open({
    title: `Supprimer la table ${table.label} ?`,
    description: 'Son QR code cessera de fonctionner. L\'historique des commandes est conservé.',
    confirmLabel: 'Supprimer',
  });
  if (!ok) return;
  try {
    await api(`${restaurant.base}/tables/${table.id}`, { method: 'DELETE' });
    toast.add({ title: `Table ${table.label} supprimée`, color: 'success', icon: 'i-lucide-trash-2' });
    await refresh();
  } catch {
    // erreur déjà notifiée
  }
}

function tableMenu(table: DiningTable): DropdownMenuItem[][] {
  const groups: DropdownMenuItem[][] = [];
  if (canStatus.value) {
    groups.push([
      { type: 'label', label: 'Changer le statut' },
      ...(Object.keys(TABLE_STATUS) as TableStatus[]).map((s) => ({
        label: TABLE_STATUS[s]!.label,
        type: 'checkbox' as const,
        checked: table.status === s,
        onSelect: () => setStatus(table, s),
      })),
    ]);
  }
  groups.push([
    { label: 'QR code', icon: 'i-lucide-qr-code', onSelect: () => qrModal.open({ table }) },
  ]);
  if (canManage.value) {
    groups.push([
      { label: 'Modifier', icon: 'i-lucide-pencil', onSelect: () => openTable(table) },
      { label: 'Supprimer', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => removeTable(table) },
    ]);
  }
  return groups;
}

function since(table: DiningTable) {
  if (table.status === 'FREE') return '';
  return formatAge(table.statusChangedAt, now.value.getTime());
}

// Statuts mis à jour par les commandes clients et les autres postes.
realtime.on('table.updated', (message) => {
  const payload = message.payload as Pick<DiningTable, 'id' | 'status' | 'statusChangedAt'>;
  const table = data.value.tables.find((t) => t.id === payload.id);
  if (table) Object.assign(table, { status: payload.status, statusChangedAt: payload.statusChangedAt });
});
</script>

<template>
  <UDashboardPanel id="tables">
    <template #header>
      <UDashboardNavbar title="Tables & QR">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton v-if="canManage" color="neutral" variant="outline" icon="i-lucide-map" label="Zone" class="hidden sm:inline-flex" @click="openZone(null)" />
          <UButton v-if="canManage" icon="i-lucide-plus" label="Tables" @click="openTable(null)" />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar v-if="data.zones.length">
        <template #left>
          <UTabs v-model="zone" :items="zoneTabs" :content="false" variant="link" size="sm" />
        </template>
        <template #right>
          <UDropdownMenu
            v-if="currentZone && canManage"
            :items="[
              { label: 'Renommer', icon: 'i-lucide-pencil', onSelect: () => openZone(currentZone) },
              { label: 'Supprimer la zone', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => removeZone(currentZone!) },
            ]"
          >
            <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-settings-2" :aria-label="`Gérer la zone ${currentZone.name}`" />
          </UDropdownMenu>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div v-if="status === 'pending' && !data.tables.length" class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <USkeleton v-for="n in 12" :key="n" class="h-28 rounded-xl" />
      </div>

      <UEmpty
        v-else-if="!data.tables.length"
        icon="i-lucide-qr-code"
        title="Aucune table pour l'instant"
        description="Créez vos tables : chacune reçoit un QR code unique à imprimer et coller dessus."
        :actions="canManage ? [{ label: 'Ajouter des tables', icon: 'i-lucide-plus', onClick: () => openTable(null) }] : undefined"
        class="py-16"
      />

      <template v-else>
        <!-- Synthèse : filtre rapide par statut -->
        <div class="mb-4 flex flex-wrap gap-2">
          <UButton
            size="sm"
            :color="statusFilter === null ? 'primary' : 'neutral'"
            :variant="statusFilter === null ? 'soft' : 'ghost'"
            :label="`Toutes · ${inZone.length}`"
            @click="statusFilter = null"
          />
          <UButton
            v-for="s in summary"
            :key="s.status"
            size="sm"
            :color="statusFilter === s.status ? 'primary' : 'neutral'"
            :variant="statusFilter === s.status ? 'soft' : 'ghost'"
            @click="statusFilter = statusFilter === s.status ? null : s.status"
          >
            <span class="size-2 rounded-full" :class="DOT[colorOf(s.status)]" />
            {{ TABLE_STATUS[s.status]!.label }} · {{ s.count }}
          </UButton>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          <UDropdownMenu v-for="table in visible" :key="table.id" :items="tableMenu(table)" :content="{ align: 'start' }">
            <button
              type="button"
              class="flex h-28 flex-col justify-between rounded-xl border p-3 text-start transition hover:-translate-y-0.5 hover:shadow-md"
              :class="TILE[colorOf(table.status)]"
              :aria-label="`Table ${table.label}, ${TABLE_STATUS[table.status]!.label}`"
            >
              <div class="flex items-start justify-between gap-2">
                <span class="font-display text-2xl font-semibold leading-none text-highlighted">{{ table.label }}</span>
                <UIcon :name="table.kind === 'COUNTER' ? 'i-lucide-beer' : 'i-lucide-armchair'" class="size-4 text-muted" />
              </div>
              <div>
                <p class="flex items-center gap-1.5 text-xs font-medium">
                  <span class="size-2 rounded-full" :class="DOT[colorOf(table.status)]" />
                  {{ TABLE_STATUS[table.status]!.label }}
                </p>
                <p class="mt-0.5 text-xs text-muted">
                  <template v-if="table.capacity">{{ table.capacity }} couv.</template>
                  <template v-if="since(table)"> · {{ since(table) }}</template>
                  <template v-if="zone === 'all' && table.zone"> · {{ table.zone.name }}</template>
                </p>
              </div>
            </button>
          </UDropdownMenu>
        </div>
        <p v-if="!visible.length" class="py-10 text-center text-sm text-muted">Aucune table avec ce statut.</p>
      </template>
    </template>
  </UDashboardPanel>
</template>
