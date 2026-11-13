import { defineStore } from 'pinia';
import type { SubscriptionOverview } from '~/types/api';
import { subscriptionState } from '~/utils/subscription';

/**
 * Abonnement du propriétaire (forfait, essai, demande en attente). Chargé
 * seulement pour le propriétaire du restaurant actif : l'abonnement est le sien.
 */
export const useSubscriptionStore = defineStore('subscription', () => {
  const restaurant = useRestaurantStore();
  const nuxtApp = useNuxtApp();
  const overview = ref<SubscriptionOverview | null>(null);

  const isOwner = computed(() => restaurant.membership?.role === 'OWNER');
  const state = computed(() => (overview.value ? subscriptionState(overview.value) : null));

  async function load() {
    if (!isOwner.value) {
      overview.value = null;
      return;
    }
    overview.value = await nuxtApp.$api<SubscriptionOverview>('/billing/subscription', { silent: true }).catch(() => null);
  }

  return { overview, state, isOwner, load };
});
