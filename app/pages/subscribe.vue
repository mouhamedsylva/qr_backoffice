<script setup lang="ts">
/**
 * Écran d'abonnement affiché à la place du tableau de bord quand le
 * restaurant n'a pas d'abonnement valide (essai terminé, échéance dépassée,
 * abonnement suspendu). Le propriétaire souscrit un forfait, ce qui débloque
 * immédiatement le restaurant ; l'équipe voit un message d'attente.
 */
definePageMeta({ layout: 'wall' });
useHead({ title: 'Choisissez votre forfait · QR-Order' });

const restaurant = useRestaurantStore();
const subscription = useSubscriptionStore();

onMounted(async () => {
  if (subscription.isOwner && !subscription.overview) await subscription.load();
});

const reason = computed(() => {
  const s = subscription.state;
  if (!s || s.kind === 'none') return 'Votre restaurant n’a pas encore d’abonnement.';
  if (s.kind === 'pastDue' || s.kind === 'suspended') return 'Votre abonnement est arrivé à échéance.';
  return 'Votre période d’essai est terminée.';
});

async function onSubscribed() {
  await restaurant.load();
  await navigateTo('/', { replace: true });
}
</script>

<template>
  <div class="space-y-10">
    <!-- Propriétaire : souscription -->
    <template v-if="subscription.isOwner">
      <div class="mx-auto max-w-2xl space-y-3 text-center">
        <UBadge color="warning" variant="subtle" icon="i-lucide-lock" label="Tableau de bord en pause" />
        <h1 class="font-display text-4xl font-semibold text-highlighted">Choisissez votre forfait pour continuer</h1>
        <p class="text-muted">
          {{ reason }} Vos menus, tables et historique sont conservés : souscrivez un forfait pour rouvrir votre tableau de bord et
          le menu de vos clients.
        </p>
      </div>
      <SubscriptionPlans @subscribed="onSubscribed">
        <template #title>
          <p class="text-sm text-muted">Sans engagement · le forfait couvre tous vos restaurants.</p>
        </template>
      </SubscriptionPlans>
    </template>

    <!-- Équipe : en attente du propriétaire -->
    <div v-else class="mx-auto max-w-lg space-y-4 rounded-2xl border border-default bg-default p-8 text-center">
      <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-warning/10">
        <UIcon name="i-lucide-lock" class="size-7 text-warning" />
      </div>
      <h1 class="font-display text-2xl font-semibold text-highlighted">Accès momentanément suspendu</h1>
      <p class="text-muted">
        L’abonnement de <span class="font-medium text-highlighted">{{ restaurant.membership?.name }}</span> n’est plus actif. Le
        propriétaire doit choisir un forfait pour rouvrir le tableau de bord.
      </p>
      <UButton color="neutral" variant="outline" icon="i-lucide-rotate-cw" label="Vérifier à nouveau" @click="onSubscribed" />
    </div>
  </div>
</template>
