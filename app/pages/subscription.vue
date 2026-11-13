<script setup lang="ts">
/** Abonnement du propriétaire : état (essai, forfait, échéance) et souscription d'un forfait. */
useHead({ title: 'Abonnement · QR-Order' });

const subscription = useSubscriptionStore();
onMounted(() => subscription.load());

const state = computed(() => subscription.state);
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

const HEADER: Record<string, { icon: string; tone: string }> = {
  trial: { icon: 'i-lucide-gift', tone: 'bg-info/10 text-info' },
  trialEnded: { icon: 'i-lucide-hourglass', tone: 'bg-warning/10 text-warning' },
  active: { icon: 'i-lucide-badge-check', tone: 'bg-success/10 text-success' },
  pastDue: { icon: 'i-lucide-credit-card', tone: 'bg-warning/10 text-warning' },
  suspended: { icon: 'i-lucide-ban', tone: 'bg-error/10 text-error' },
  none: { icon: 'i-lucide-layers', tone: 'bg-elevated text-muted' },
};
</script>

<template>
  <UDashboardPanel id="subscription">
    <template #header>
      <UDashboardNavbar title="Abonnement">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UEmpty
        v-if="!subscription.isOwner"
        icon="i-lucide-lock"
        title="Réservé au propriétaire"
        description="Seul le propriétaire du restaurant gère l’abonnement."
        class="py-16"
      />

      <div v-else class="mx-auto w-full max-w-6xl space-y-8">
        <!-- État de l'abonnement -->
        <USkeleton v-if="!state" class="h-28 w-full rounded-xl" />
        <div v-else class="flex flex-col gap-4 rounded-xl border border-default bg-default p-5 sm:flex-row sm:items-center">
          <div class="flex size-12 shrink-0 items-center justify-center rounded-full" :class="HEADER[state.kind]!.tone">
            <UIcon :name="HEADER[state.kind]!.icon" class="size-6" />
          </div>
          <div class="min-w-0 flex-1 space-y-1">
            <template v-if="state.kind === 'trial'">
              <p class="font-display text-xl font-semibold text-highlighted">Essai du forfait {{ state.planName }}</p>
              <p class="text-sm text-muted">
                Plus que <span class="font-semibold text-highlighted">{{ state.daysLeft }} jour{{ state.daysLeft! > 1 ? 's' : '' }}</span>
                — jusqu’au {{ date(state.trialEndsAt) }}. Souscrivez dès maintenant pour ne pas être interrompu.
              </p>
            </template>
            <template v-else-if="state.kind === 'active'">
              <p class="font-display text-xl font-semibold text-highlighted">Forfait {{ state.planName }}</p>
              <p class="text-sm text-muted">Actif<span v-if="state.periodEnd"> jusqu’au {{ date(state.periodEnd) }}</span>.</p>
            </template>
            <template v-else-if="state.kind === 'pastDue'">
              <p class="font-display text-xl font-semibold text-highlighted">Renouvellement en attente</p>
              <p class="text-sm text-muted">
                Votre forfait {{ state.planName }} est arrivé à échéance. Renouvelez-le pour éviter l’interruption de votre restaurant.
              </p>
            </template>
            <template v-else>
              <p class="font-display text-xl font-semibold text-highlighted">Aucun abonnement actif</p>
              <p class="text-sm text-muted">Choisissez un forfait pour utiliser QR-Order.</p>
            </template>
          </div>
        </div>

        <SubscriptionPlans />
      </div>
    </template>
  </UDashboardPanel>
</template>
