<script setup lang="ts">
/** Moyens de paiement : espèces, carte via Stripe Connect (PAY-02), mobile money. */
const api = useApi();
const restaurant = useRestaurantStore();
const route = useRoute();
const toast = useToast();
const canBilling = computed(() => restaurant.can('billing.manage'));

const { data: stripe, status, refresh } = useAsyncData(
  'stripe-status',
  async () => {
    if (!canBilling.value) return null;
    try {
      return await api<{ connected: boolean; chargesEnabled: boolean; mode?: 'merchant' | 'recipient' }>(`${restaurant.base}/payments/stripe/status`, { silent: true });
    } catch {
      return null;
    }
  },
  { watch: [() => restaurant.id] },
);

// Retour depuis Stripe : on rafraîchit l'état du compte.
onMounted(() => {
  if (route.query.stripe) {
    void refresh();
    toast.add({ title: 'Retour de Stripe', description: 'Statut du compte mis à jour.', icon: 'i-lucide-credit-card' });
  }
});

const linking = ref(false);
async function onboard() {
  linking.value = true;
  try {
    const back = `${window.location.origin}/settings?tab=payments`;
    const { url } = await api<{ url: string }>(`${restaurant.base}/payments/stripe/onboarding`, {
      method: 'POST',
      body: { returnUrl: `${back}&stripe=return`, refreshUrl: `${back}&stripe=refresh` },
    });
    window.location.href = url;
  } catch {
    linking.value = false;
  }
}

const stripeState = computed(() => {
  if (!stripe.value?.connected) return { label: 'Non connecté', color: 'neutral' as const };
  if (!stripe.value.chargesEnabled) return { label: 'Vérification en cours', color: 'warning' as const };
  return { label: 'Actif', color: 'success' as const };
});
</script>

<template>
  <UPageCard title="Moyens de paiement" description="Ce que vos clients peuvent utiliser pour régler depuis leur téléphone ou en caisse." variant="subtle">
    <ul class="divide-y divide-default">
      <li class="flex items-center gap-4 py-3">
        <UIcon name="i-lucide-banknote" class="size-6 text-success" />
        <div class="flex-1">
          <p class="font-medium">Espèces</p>
          <p class="text-sm text-muted">Encaissement en caisse depuis la fiche commande, avec calcul de la monnaie.</p>
        </div>
        <UBadge color="success" variant="subtle" label="Toujours actif" />
      </li>

      <li class="flex flex-wrap items-center gap-4 py-3">
        <UIcon name="i-lucide-credit-card" class="size-6 text-info" />
        <div class="min-w-48 flex-1">
          <p class="font-medium">Carte bancaire <span class="text-xs text-muted">· Stripe</span></p>
          <p v-if="stripe?.mode === 'recipient'" class="text-sm text-muted">
            Stripe n’ouvre pas de compte marchand dans votre pays : les paiements par carte sont encaissés par QR-Order, puis versés
            sur votre compte bancaire via Stripe (versements internationaux), commission déduite.
          </p>
          <p v-else class="text-sm text-muted">
            Les paiements arrivent directement sur votre compte Stripe. QR-Order ne détient jamais les fonds.
          </p>
        </div>
        <template v-if="canBilling">
          <USkeleton v-if="status === 'pending'" class="h-6 w-24" />
          <UBadge v-else :color="stripeState.color" variant="subtle" :label="stripeState.label" />
          <UButton
            v-if="!stripe?.chargesEnabled"
            :label="stripe?.connected ? 'Terminer la configuration' : 'Connecter Stripe'"
            icon="i-lucide-external-link"
            :loading="linking"
            @click="onboard"
          />
        </template>
        <span v-else class="text-sm text-muted">Réservé au propriétaire</span>
      </li>

      <li class="flex items-center gap-4 py-3">
        <UIcon name="i-lucide-smartphone" class="size-6 text-warning" />
        <div class="flex-1">
          <p class="font-medium">Mobile money</p>
          <p class="text-sm text-muted">Wave, Orange Money, Free Money… activé dès que le fournisseur est configuré sur la plateforme.</p>
        </div>
        <UBadge color="neutral" variant="outline" label="Bientôt" />
      </li>
    </ul>
  </UPageCard>
</template>
