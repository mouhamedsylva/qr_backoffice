<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import { useClipboard } from '@vueuse/core';
import { ConfirmModal, PromotionsPromotionFormModal } from '#components';
import type { Promotion } from '~/types/api';
import { benefitLabel, PROMOTION_STATE, promotionState } from '~/utils/promotions';

useHead({ title: 'Promotions & fidélité · QR-Order' });

const api = useApi();
const route = useRoute();
const router = useRouter();
const restaurant = useRestaurantStore();
const toast = useToast();
const overlay = useOverlay();
const { money, dateTime } = useMoney();
const { nameOf } = useMenuItemOptions();
const { copy } = useClipboard();
const promoModal = overlay.create(PromotionsPromotionFormModal);
const confirm = overlay.create(ConfirmModal);

const tab = computed({
  get: () => (route.query.tab === 'loyalty' ? 'loyalty' : 'promotions'),
  set: (v) => router.replace({ query: { tab: v === 'promotions' ? undefined : v } }),
});

const locked = ref(false);
const { data: promotions, status, refresh } = useAsyncData(
  'promotions',
  async () => {
    try {
      locked.value = false;
      return await api<Promotion[]>(`${restaurant.base}/promotions`, { silent: true });
    } catch (err) {
      locked.value = apiErrorCode(err) === 'FEATURE_NOT_IN_PLAN';
      return [];
    }
  },
  { default: () => [], watch: [() => restaurant.id] },
);

const filter = ref<'all' | 'active' | 'other'>('all');
const visible = computed(() =>
  promotions.value.filter((p) => {
    const s = promotionState(p);
    return filter.value === 'all' || (filter.value === 'active' ? s === 'active' || s === 'scheduled' : s !== 'active' && s !== 'scheduled');
  }),
);
const activeCount = computed(() => promotions.value.filter((p) => promotionState(p) === 'active').length);
const totalUses = computed(() => promotions.value.reduce((s, p) => s + p.usageCount, 0));

async function open(p: Promotion | null) {
  if (await promoModal.open({ promotion: p })) await refresh();
}
async function toggle(p: Promotion) {
  try {
    await api(`${restaurant.base}/promotions/${p.id}`, { method: 'PATCH', body: { isActive: !p.isActive } });
    p.isActive = !p.isActive;
  } catch {
    // erreur déjà notifiée
  }
}
async function remove(p: Promotion) {
  if (!(await confirm.open({ title: `Supprimer le code ${p.code} ?`, description: 'Il ne pourra plus être utilisé. Les commandes passées gardent leur remise.', confirmLabel: 'Supprimer' }))) return;
  try {
    await api(`${restaurant.base}/promotions/${p.id}`, { method: 'DELETE' });
    toast.add({ title: 'Code supprimé', color: 'success', icon: 'i-lucide-trash-2' });
    await refresh();
  } catch {
    // erreur déjà notifiée
  }
}
function copyCode(p: Promotion) {
  copy(p.code);
  toast.add({ title: `${p.code} copié`, icon: 'i-lucide-copy' });
}

function menu(p: Promotion): DropdownMenuItem[][] {
  return [
    [
      { label: 'Modifier', icon: 'i-lucide-pencil', onSelect: () => open(p) },
      { label: p.isActive ? 'Mettre en pause' : 'Réactiver', icon: p.isActive ? 'i-lucide-pause' : 'i-lucide-play', onSelect: () => toggle(p) },
      { label: 'Copier le code', icon: 'i-lucide-copy', onSelect: () => copyCode(p) },
    ],
    [{ label: 'Supprimer', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => remove(p) }],
  ];
}

function period(p: Promotion) {
  const f = (d: string) => dateTime(d, { dateStyle: 'medium' });
  if (p.startsAt && p.endsAt) return `Du ${f(p.startsAt)} au ${f(p.endsAt)}`;
  if (p.endsAt) return `Jusqu'au ${f(p.endsAt)}`;
  if (p.startsAt) return `À partir du ${f(p.startsAt)}`;
  return 'Sans limite de date';
}
</script>

<template>
  <UDashboardPanel id="promotions">
    <template #header>
      <UDashboardNavbar title="Promotions & fidélité">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton v-if="tab === 'promotions' && !locked" icon="i-lucide-plus" label="Code promo" @click="open(null)" />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <UTabs
          v-model="tab"
          :items="[
            { label: 'Codes promo', value: 'promotions', icon: 'i-lucide-ticket-percent' },
            { label: 'Fidélité', value: 'loyalty', icon: 'i-lucide-heart-handshake' },
          ]"
          :content="false"
          variant="link"
          size="sm"
        />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-5xl">
        <PromotionsLoyaltyPanel v-if="tab === 'loyalty'" />

        <PlanUpsell
          v-else-if="locked"
          icon="i-lucide-ticket-percent"
          title="Attirez du monde aux heures creuses"
          description="Codes promo en pourcentage ou en montant, « 2 achetés = 1 offert », dates de validité et plafonds d'utilisation. Inclus dans le forfait Pro."
        />

        <div v-else class="space-y-6">
          <div class="grid gap-4 sm:grid-cols-3">
            <DashboardKpiCard label="Codes actifs" :value="String(activeCount)" icon="i-lucide-ticket-percent" :loading="status === 'pending' && !promotions.length" />
            <DashboardKpiCard label="Utilisations" :value="totalUses.toLocaleString('fr-FR')" icon="i-lucide-shopping-bag" :loading="status === 'pending' && !promotions.length" />
            <DashboardKpiCard label="Codes créés" :value="String(promotions.length)" icon="i-lucide-layers" :loading="status === 'pending' && !promotions.length" />
          </div>

          <div v-if="promotions.length" class="flex gap-2">
            <UButton
              v-for="f in [{ v: 'all', l: 'Tous' }, { v: 'active', l: 'En cours' }, { v: 'other', l: 'Terminés ou en pause' }] as const"
              :key="f.v"
              size="sm"
              :color="filter === f.v ? 'primary' : 'neutral'"
              :variant="filter === f.v ? 'soft' : 'ghost'"
              :label="f.l"
              @click="filter = f.v"
            />
          </div>

          <UEmpty
            v-if="status !== 'pending' && !promotions.length"
            icon="i-lucide-ticket-percent"
            title="Aucun code promo"
            description="Créez un code à partager sur WhatsApp ou à afficher en salle."
            :actions="[{ label: 'Créer un code', icon: 'i-lucide-plus', onClick: () => open(null) }]"
            class="py-12"
          />

          <div v-else class="grid gap-4 md:grid-cols-2">
            <article
              v-for="p in visible"
              :key="p.id"
              class="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-default bg-default p-4"
              :class="['expired', 'paused'].includes(promotionState(p)) && 'opacity-70'"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <button type="button" class="font-mono text-lg font-bold tracking-wide text-primary" title="Copier" @click="copyCode(p)">
                    {{ p.code }}
                  </button>
                  <p class="truncate text-sm text-muted">{{ p.name }}</p>
                </div>
                <div class="flex items-center gap-1">
                  <UBadge :color="PROMOTION_STATE[promotionState(p)].color" variant="subtle" :label="PROMOTION_STATE[promotionState(p)].label" />
                  <UDropdownMenu :items="menu(p)" :content="{ align: 'end' }">
                    <UButton size="xs" icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" aria-label="Actions" />
                  </UDropdownMenu>
                </div>
              </div>
              <p class="font-display text-2xl font-semibold text-highlighted">
                {{ benefitLabel(p, restaurant.currency, restaurant.locale, nameOf(p.menuItemId)) }}
              </p>
              <ul class="space-y-0.5 text-xs text-muted">
                <li><UIcon name="i-lucide-calendar" class="align-middle" /> {{ period(p) }}</li>
                <li v-if="p.minSubtotal"><UIcon name="i-lucide-shopping-basket" class="align-middle" /> Dès {{ money(p.minSubtotal) }} de commande</li>
                <li v-if="p.maxDiscount"><UIcon name="i-lucide-arrow-down-to-line" class="align-middle" /> Remise plafonnée à {{ money(p.maxDiscount) }}</li>
                <li v-if="p.perCustomerLimit"><UIcon name="i-lucide-user" class="align-middle" /> {{ p.perCustomerLimit }} fois par client</li>
              </ul>
              <div class="mt-auto space-y-1">
                <div class="flex justify-between text-xs">
                  <span class="text-muted">Utilisations</span>
                  <span class="tabular font-medium">{{ p.usageCount }}{{ p.usageLimit ? ` / ${p.usageLimit}` : '' }}</span>
                </div>
                <UProgress v-if="p.usageLimit" :model-value="Math.min(100, (p.usageCount / p.usageLimit) * 100)" size="xs" />
              </div>
            </article>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
