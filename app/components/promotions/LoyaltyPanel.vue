<script setup lang="ts">
/** Programme de fidélité : règle de gain, récompenses, comptes clients (FID-01 à FID-04). */
import { ConfirmModal, PromotionsAdjustPointsModal, PromotionsRewardFormModal } from '#components';
import type { LoyaltyAccount, LoyaltyProgram, LoyaltyReward } from '~/types/api';
import { benefitLabel } from '~/utils/promotions';

const api = useApi();
const restaurant = useRestaurantStore();
const toast = useToast();
const overlay = useOverlay();
const { money, dateTime } = useMoney();
const { nameOf } = useMenuItemOptions();
const rewardModal = overlay.create(PromotionsRewardFormModal);
const adjustModal = overlay.create(PromotionsAdjustPointsModal);
const confirm = overlay.create(ConfirmModal);

const locked = ref(false);
const { data, status, refresh } = useAsyncData(
  'loyalty',
  async () => {
    try {
      locked.value = false;
      const [config, accounts] = await Promise.all([
        api<{ program: LoyaltyProgram | null; rewards: LoyaltyReward[] }>(`${restaurant.base}/loyalty`, { silent: true }),
        api<LoyaltyAccount[]>(`${restaurant.base}/loyalty/accounts`, { silent: true }),
      ]);
      return { ...config, accounts };
    } catch (err) {
      locked.value = apiErrorCode(err) === 'FEATURE_NOT_IN_PLAN';
      return null;
    }
  },
  { watch: [() => restaurant.id] },
);

// Règle de gain : « N points par tranche de X dépensés » (X saisi en unité principale).
const program = reactive({ isActive: false, pointsPerUnit: 1, unit: 100, expiryDays: null as number | null });
watch(
  () => data.value?.program,
  (p) => {
    program.isActive = p?.isActive ?? false;
    program.pointsPerUnit = p?.pointsPerUnit ?? 1;
    program.unit = fromMinorUnits(p?.unitAmount ?? toMinorUnits(100, restaurant.currency), restaurant.currency);
    program.expiryDays = p?.expiryDays ?? null;
  },
  { immediate: true },
);
const example = computed(() => {
  const spend = 10_000;
  return Math.floor(spend / (program.unit || 1)) * program.pointsPerUnit;
});

const saving = ref(false);
async function saveProgram() {
  saving.value = true;
  try {
    await api(`${restaurant.base}/loyalty`, {
      method: 'PUT',
      body: {
        isActive: program.isActive,
        pointsPerUnit: program.pointsPerUnit,
        unitAmount: toMinorUnits(program.unit, restaurant.currency),
        expiryDays: program.expiryDays || null,
      },
    });
    toast.add({ title: 'Programme de fidélité enregistré', color: 'success', icon: 'i-lucide-check' });
    await refresh();
  } catch {
    // erreur déjà notifiée
  } finally {
    saving.value = false;
  }
}

async function openReward(reward: LoyaltyReward | null) {
  if (await rewardModal.open({ reward })) await refresh();
}
async function removeReward(reward: LoyaltyReward) {
  if (!(await confirm.open({ title: `Supprimer « ${reward.name} » ?`, description: 'Les bons déjà émis restent valables.', confirmLabel: 'Supprimer' }))) return;
  await api(`${restaurant.base}/loyalty/rewards/${reward.id}`, { method: 'DELETE' }).catch(() => undefined);
  await refresh();
}
async function adjust(account: LoyaltyAccount) {
  if (await adjustModal.open({ account })) await refresh();
}

const search = ref('');
const accounts = computed(() => {
  const q = search.value.trim().toLowerCase();
  return (data.value?.accounts ?? []).filter(
    (a) => !q || `${a.user.firstName} ${a.user.lastName} ${a.user.email}`.toLowerCase().includes(q),
  );
});
const totalPoints = computed(() => (data.value?.accounts ?? []).reduce((s, a) => s + a.points, 0));
</script>

<template>
  <PlanUpsell
    v-if="locked"
    icon="i-lucide-heart-handshake"
    title="Fidélisez vos habitués"
    description="Vos clients cumulent des points à chaque commande et les échangent contre un plat ou une réduction. Inclus dans le forfait Pro."
  />

  <div v-else-if="status === 'pending' && !data" class="space-y-4">
    <USkeleton class="h-48 w-full" />
    <USkeleton class="h-32 w-full" />
  </div>

  <div v-else-if="data" class="space-y-6">
    <UPageCard title="Programme" description="Les points sont crédités automatiquement quand la commande est payée." variant="subtle">
      <USwitch v-model="program.isActive" label="Programme actif" />
      <div class="flex flex-wrap items-end gap-3">
        <UFormField label="Points gagnés">
          <UInputNumber v-model="program.pointsPerUnit" :min="1" class="w-28" />
        </UFormField>
        <span class="pb-2 text-sm text-muted">par tranche de</span>
        <UFormField label="Montant dépensé">
          <UInputNumber
            v-model="program.unit"
            :min="1"
            :step="100"
            class="w-40"
            :format-options="{ style: 'currency', currency: restaurant.currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: fractionDigits(restaurant.currency) }"
          />
        </UFormField>
        <UFormField label="Expiration" hint="jours sans visite · vide = jamais">
          <UInputNumber v-model="program.expiryDays" :min="1" class="w-40" />
        </UFormField>
      </div>
      <p class="text-sm text-muted">
        Exemple : une commande de {{ money(toMinorUnits(10_000, restaurant.currency)) }} rapporte <strong class="text-default">{{ example }} points</strong>.
      </p>
      <div class="flex justify-end">
        <UButton label="Enregistrer" icon="i-lucide-save" :loading="saving" @click="saveProgram" />
      </div>
    </UPageCard>

    <UPageCard title="Récompenses" description="Ce que vos clients peuvent obtenir avec leurs points." variant="subtle">
      <template #links>
        <UButton icon="i-lucide-plus" label="Récompense" color="neutral" variant="outline" @click="openReward(null)" />
      </template>
      <p v-if="!data.rewards.length" class="text-sm text-muted">Aucune récompense : ajoutez-en une pour donner envie de revenir.</p>
      <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="r in data.rewards"
          :key="r.id"
          class="flex flex-col gap-2 rounded-lg border border-default bg-default p-4"
          :class="!r.isActive && 'opacity-60'"
        >
          <div class="flex items-start justify-between gap-2">
            <p class="font-medium text-highlighted">{{ r.name }}</p>
            <UBadge color="primary" variant="subtle" :label="`${r.pointsCost} pts`" />
          </div>
          <p class="text-sm text-muted">{{ benefitLabel({ ...r, buyQuantity: null, freeQuantity: null }, restaurant.currency, restaurant.locale, nameOf(r.menuItemId)) }}</p>
          <div class="mt-auto flex gap-1">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" label="Modifier" @click="openReward(r)" />
            <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Supprimer" @click="removeReward(r)" />
          </div>
        </div>
      </div>
    </UPageCard>

    <UPageCard
      title="Clients fidèles"
      :description="`${data.accounts.length} client(s) · ${totalPoints.toLocaleString('fr-FR')} points en circulation`"
      variant="subtle"
    >
      <template #links>
        <UInput v-model="search" icon="i-lucide-search" placeholder="Rechercher…" size="sm" class="w-48" />
      </template>
      <p v-if="!accounts.length" class="text-sm text-muted">
        {{ search ? 'Aucun client trouvé.' : 'Les clients connectés à leur compte apparaîtront ici après leur première commande payée.' }}
      </p>
      <ul v-else class="divide-y divide-default rounded-lg border border-default">
        <li v-for="a in accounts" :key="a.id" class="flex items-center gap-3 px-3 py-2">
          <UAvatar :text="`${a.user.firstName[0] ?? ''}${a.user.lastName[0] ?? ''}`" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ a.user.firstName }} {{ a.user.lastName }}</p>
            <p class="truncate text-xs text-muted">{{ a.user.email }} · dernière visite {{ dateTime(a.lastActivityAt, { dateStyle: 'medium' }) }}</p>
          </div>
          <div class="text-right">
            <p class="tabular text-sm font-semibold text-highlighted">{{ a.points.toLocaleString('fr-FR') }} pts</p>
            <p class="tabular text-xs text-muted">{{ a.lifetimePoints.toLocaleString('fr-FR') }} cumulés</p>
          </div>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-coins" aria-label="Ajuster les points" @click="adjust(a)" />
        </li>
      </ul>
    </UPageCard>
  </div>
</template>
