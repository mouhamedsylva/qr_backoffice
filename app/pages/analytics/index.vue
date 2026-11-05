<script setup lang="ts">
import type { AnalyticsOverview, MenuPerformance, TaxReport } from '~/types/api';

useHead({ title: 'Analytics · QR-Order' });

const api = useApi();
const route = useRoute();
const router = useRouter();
const restaurant = useRestaurantStore();
const toast = useToast();

type Tab = 'activity' | 'menu' | 'tax';
const tab = computed<Tab>({
  get: () => (['menu', 'tax'].includes(String(route.query.tab)) ? (route.query.tab as Tab) : 'activity'),
  set: (v) => router.replace({ query: { ...route.query, tab: v === 'activity' ? undefined : v } }),
});

// --- Période (l'API exclut la borne de fin ; 366 jours maximum)
const PRESETS = [
  { label: '7 jours', value: '7' },
  { label: '30 jours', value: '30' },
  { label: '90 jours', value: '90' },
  { label: 'Ce mois-ci', value: 'month' },
  { label: 'Mois dernier', value: 'last-month' },
  { label: '12 mois', value: '365' },
  { label: 'Personnalisée', value: 'custom' },
];
const preset = ref('30');
const customFrom = ref('');
const customTo = ref('');

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const range = computed<{ from: Date; to: Date } | null>(() => {
  const now = new Date();
  const tomorrow = new Date(startOfDay(now).getTime() + 864e5);
  switch (preset.value) {
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: tomorrow };
    case 'last-month':
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case 'custom':
      if (!customFrom.value || !customTo.value || customTo.value < customFrom.value) return null;
      return { from: new Date(`${customFrom.value}T00:00:00`), to: new Date(new Date(`${customTo.value}T00:00:00`).getTime() + 864e5) };
    default:
      return { from: new Date(tomorrow.getTime() - Number(preset.value) * 864e5), to: tomorrow };
  }
});
const query = computed(() => (range.value ? { from: range.value.from.toISOString(), to: range.value.to.toISOString() } : null));
const rangeLabel = computed(() => {
  if (!range.value) return '';
  const f = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${f(range.value.from)} → ${f(new Date(range.value.to.getTime() - 1))}`;
});

const taxGroupBy = ref<'day' | 'month'>('day');
watch(preset, (p) => (taxGroupBy.value = p === '365' ? 'month' : taxGroupBy.value));

// --- Données (chargées à la demande, selon l'onglet)
const locked = ref(false);
async function fetchSection<T>(path: string, extra: Record<string, string> = {}): Promise<T | null> {
  if (!query.value) return null;
  try {
    locked.value = false;
    return await api<T>(`${restaurant.base}/analytics/${path}`, { query: { ...query.value, ...extra }, silent: true });
  } catch (err) {
    if (apiErrorCode(err) === 'FEATURE_NOT_IN_PLAN') locked.value = true;
    else toast.add({ title: 'Statistiques indisponibles', description: apiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' });
    return null;
  }
}

const overview = useAsyncData('analytics-overview', () => (tab.value === 'activity' ? fetchSection<AnalyticsOverview>('overview') : Promise.resolve(null)), {
  watch: [query, tab, () => restaurant.id],
});
const menu = useAsyncData('analytics-menu', () => (tab.value === 'menu' ? fetchSection<MenuPerformance>('menu') : Promise.resolve(null)), {
  watch: [query, tab, () => restaurant.id],
});
const tax = useAsyncData('analytics-tax', () => (tab.value === 'tax' ? fetchSection<TaxReport>('tax', { groupBy: taxGroupBy.value }) : Promise.resolve(null)), {
  watch: [query, tab, taxGroupBy, () => restaurant.id],
});

// --- Export CSV de l'onglet courant (ANA-04)
const exporting = ref(false);
async function exportCsv() {
  if (!query.value) return;
  const path = { activity: 'overview', menu: 'menu', tax: 'tax' }[tab.value];
  const name = { activity: 'activite', menu: 'performance-menu', tax: 'rapport-tva' }[tab.value];
  exporting.value = true;
  try {
    const blob = await api<Blob>(`${restaurant.base}/analytics/${path}`, {
      query: { ...query.value, format: 'csv', ...(tab.value === 'tax' && { groupBy: taxGroupBy.value }) },
      responseType: 'blob',
    });
    downloadBlob(blob, `${name}-${restaurant.membership?.slug ?? 'restaurant'}-${query.value.from.slice(0, 10)}.csv`);
  } catch {
    // erreur déjà notifiée
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <UDashboardPanel id="analytics">
    <template #header>
      <UDashboardNavbar title="Analytics">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            v-if="!locked"
            color="neutral"
            variant="outline"
            icon="i-lucide-download"
            label="Exporter CSV"
            :loading="exporting"
            :disabled="!query"
            @click="exportCsv"
          />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <template #left>
          <UTabs
            v-model="tab"
            :items="[
              { label: 'Activité', value: 'activity', icon: 'i-lucide-activity' },
              { label: 'Menu', value: 'menu', icon: 'i-lucide-book-open' },
              { label: 'TVA', value: 'tax', icon: 'i-lucide-landmark' },
            ]"
            :content="false"
            variant="link"
            size="sm"
          />
        </template>
        <template #right>
          <div class="flex flex-wrap items-center gap-2">
            <template v-if="preset === 'custom'">
              <UInput v-model="customFrom" type="date" size="sm" aria-label="Du" class="w-36" />
              <UInput v-model="customTo" type="date" size="sm" aria-label="Au" :min="customFrom" class="w-36" />
            </template>
            <span v-else class="hidden text-xs text-muted lg:inline">{{ rangeLabel }}</span>
            <USelect v-model="preset" :items="PRESETS" size="sm" icon="i-lucide-calendar" class="w-40" />
          </div>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <PlanUpsell
        v-if="locked"
        icon="i-lucide-chart-line"
        title="Pilotez votre restaurant avec des chiffres"
        description="Chiffre d'affaires et évolution, heures de pointe, plats les plus rentables, rapport de TVA prêt pour le comptable et exports CSV. Inclus dans le forfait Pro."
      />
      <UEmpty
        v-else-if="!query"
        icon="i-lucide-calendar-range"
        title="Choisissez une période"
        description="Indiquez une date de début et une date de fin (366 jours maximum)."
        variant="naked"
      />
      <AnalyticsActivityTab v-else-if="tab === 'activity'" :data="overview.data.value ?? null" :loading="overview.status.value === 'pending'" />
      <AnalyticsMenuTab v-else-if="tab === 'menu'" :data="menu.data.value ?? null" :loading="menu.status.value === 'pending'" />
      <AnalyticsTaxTab v-else v-model:group-by="taxGroupBy" :data="tax.data.value ?? null" :loading="tax.status.value === 'pending'" />
    </template>
  </UDashboardPanel>
</template>
