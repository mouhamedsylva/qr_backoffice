<script setup lang="ts">
/**
 * Grille des forfaits avec souscription immédiate : utilisée par la page
 * Abonnement et par l'écran d'abonnement qui bloque le tableau de bord.
 */
import type { BillingCycle, Plan } from '~/types/api';
import { FEATURES } from '~/utils/plan-features';
import { yearlySaving } from '~/utils/subscription';

const emit = defineEmits<{ subscribed: [plan: Plan] }>();

const api = useApi();
const toast = useToast();
const subscription = useSubscriptionStore();

const { data: plans, status } = useAsyncData('billing-plans', () => api<Plan[]>('/billing/plans'), { default: () => [] });

const state = computed(() => subscription.state);
const overview = computed(() => subscription.overview);
const cycle = ref<BillingCycle>('MONTHLY');
watch(
  () => overview.value?.subscription?.billingCycle,
  (c) => {
    if (c) cycle.value = c;
  },
  { immediate: true },
);
const bestSaving = computed(() => Math.max(0, ...plans.value.map((p) => yearlySaving(p.priceMonthly, p.priceYearly) ?? 0)));
const quota = (v: number | null) => (v === null ? 'Illimité' : v.toLocaleString('fr-FR'));
const ALL_FEATURES = Object.keys(FEATURES);

/** Forfait déjà en vigueur (essai en cours ou abonnement actif). */
function isCurrent(p: Plan) {
  const s = state.value;
  return !!s && s.planCode === p.code && (s.kind === 'trial' || s.kind === 'active');
}
/** Usage au-delà des quotas du forfait : souscription impossible. */
function overQuota(p: Plan): string | null {
  const u = overview.value?.usage;
  if (!u) return null;
  if (p.maxRestaurants !== null && u.restaurants > p.maxRestaurants) return `${u.restaurants} restaurants (max ${p.maxRestaurants})`;
  if (p.maxTables !== null && u.tables > p.maxTables) return `${u.tables} tables (max ${p.maxTables})`;
  if (p.maxMembers !== null && u.members > p.maxMembers) return `${u.members} membres (max ${p.maxMembers})`;
  return null;
}
/** Le forfait le plus complet est mis en avant tant qu'aucun n'est en vigueur. */
const highlighted = computed(() => plans.value.find((p) => p.code === 'PRO')?.code ?? null);

const choosing = ref<string | null>(null);
async function choose(plan: Plan) {
  choosing.value = plan.code;
  try {
    await api('/billing/subscription/choose', { method: 'POST', body: { planCode: plan.code, billingCycle: cycle.value } });
    toast.add({
      title: `Forfait ${plan.name} activé`,
      description: cycle.value === 'YEARLY' ? 'Pour un an. Merci de votre confiance !' : 'Pour un mois. Merci de votre confiance !',
      color: 'success',
      icon: 'i-lucide-badge-check',
    });
    await subscription.load();
    emit('subscribed', plan);
  } catch {
    // erreur déjà notifiée (ex. usage dépassant le forfait)
  } finally {
    choosing.value = null;
  }
}
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <slot name="title">
        <div>
          <h2 class="font-display text-2xl font-semibold text-highlighted">Nos forfaits</h2>
          <p class="text-sm text-muted">Sans engagement. Le forfait couvre tous vos restaurants.</p>
        </div>
      </slot>
      <div class="flex items-center rounded-full bg-elevated p-1 text-sm">
        <button
          v-for="c in (['MONTHLY', 'YEARLY'] as const)"
          :key="c"
          type="button"
          class="rounded-full px-4 py-1.5 font-medium transition"
          :class="cycle === c ? 'bg-default text-highlighted shadow-sm' : 'text-muted hover:text-highlighted'"
          @click="cycle = c"
        >
          {{ c === 'MONTHLY' ? 'Mensuel' : 'Annuel' }}
          <span v-if="c === 'YEARLY' && bestSaving" class="ml-1 rounded-full bg-success/15 px-1.5 py-0.5 text-xs text-success">−{{ bestSaving }} %</span>
        </button>
      </div>
    </div>

    <div v-if="status === 'pending' && !plans.length" class="grid gap-4 lg:grid-cols-3">
      <USkeleton v-for="n in 3" :key="n" class="h-96 rounded-2xl" />
    </div>
    <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="p in plans"
        :key="p.id"
        class="relative flex flex-col rounded-2xl border bg-default p-6 transition"
        :class="
          isCurrent(p)
            ? 'border-primary ring-2 ring-primary/20'
            : !state || (state.kind !== 'active' && state.kind !== 'trial' && highlighted === p.code)
              ? 'border-primary/50 shadow-lg'
              : 'border-default'
        "
      >
        <UBadge v-if="isCurrent(p)" class="absolute -top-3 left-6" color="primary" :label="state?.kind === 'trial' ? 'En essai' : 'Forfait actuel'" />
        <UBadge v-else-if="highlighted === p.code" class="absolute -top-3 left-6" color="primary" variant="subtle" icon="i-lucide-sparkles" label="Le plus choisi" />

        <p class="font-display text-2xl font-semibold text-highlighted">{{ p.name }}</p>
        <p class="mt-3">
          <span class="tabular font-display text-4xl font-semibold text-highlighted">
            {{ formatMoney(cycle === 'MONTHLY' ? p.priceMonthly : p.priceYearly, p.currency) }}
          </span>
          <span class="text-sm text-muted"> / {{ cycle === 'MONTHLY' ? 'mois' : 'an' }}</span>
        </p>
        <p class="h-5 text-sm text-success">
          <template v-if="cycle === 'YEARLY' && yearlySaving(p.priceMonthly, p.priceYearly)">
            Économisez {{ yearlySaving(p.priceMonthly, p.priceYearly) }} % par rapport au mensuel
          </template>
        </p>

        <ul class="mt-4 space-y-1.5 text-sm">
          <li class="flex justify-between"><span class="text-muted">Restaurants</span><span class="font-medium">{{ quota(p.maxRestaurants) }}</span></li>
          <li class="flex justify-between"><span class="text-muted">Tables par restaurant</span><span class="font-medium">{{ quota(p.maxTables) }}</span></li>
          <li class="flex justify-between"><span class="text-muted">Membres d’équipe</span><span class="font-medium">{{ quota(p.maxMembers) }}</span></li>
        </ul>
        <USeparator class="my-4" />
        <ul class="flex-1 space-y-2 text-sm">
          <li v-for="f in ALL_FEATURES" :key="f" class="flex items-center gap-2" :class="!p.features.includes(f) && 'text-dimmed line-through decoration-dimmed/40'">
            <UIcon :name="p.features.includes(f) ? 'i-lucide-check' : 'i-lucide-minus'" class="size-4 shrink-0" :class="p.features.includes(f) ? 'text-success' : ''" />
            {{ FEATURES[f]!.label }}
          </li>
        </ul>

        <p v-if="overQuota(p)" class="mt-4 text-xs text-warning">Votre usage dépasse ce forfait : {{ overQuota(p) }}.</p>
        <UButton
          class="mt-5"
          block
          size="lg"
          :color="isCurrent(p) ? 'neutral' : 'primary'"
          :variant="isCurrent(p) ? 'soft' : 'solid'"
          :label="isCurrent(p) && state?.kind === 'active' ? 'Votre forfait' : `Souscrire au forfait ${p.name}`"
          :disabled="(isCurrent(p) && state?.kind === 'active') || !!overQuota(p) || !!choosing"
          :loading="choosing === p.code"
          @click="choose(p)"
        />
      </article>
    </div>
  </section>
</template>
