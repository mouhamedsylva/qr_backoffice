import { defineStore } from 'pinia';
import type { Restaurant, RestaurantMembership } from '~/types/api';

const ACTIVE_KEY = 'qro.activeRestaurant';

/**
 * Restaurant actif et droits de l'utilisateur sur celui-ci. Les droits ne
 * servent qu'à adapter l'interface : l'API reste seule juge.
 */
export const useRestaurantStore = defineStore('restaurant', () => {
  const auth = useAuthStore();
  const nuxtApp = useNuxtApp();
  const activeId = ref<string | null>(null);
  const details = ref<Restaurant | null>(null);

  const memberships = computed<RestaurantMembership[]>(() => auth.user?.restaurants ?? []);
  const membership = computed(
    () => memberships.value.find((m) => m.id === activeId.value) ?? memberships.value[0] ?? null,
  );
  const id = computed(() => membership.value?.id ?? null);
  const currency = computed(() => details.value?.currency ?? membership.value?.currency ?? 'XOF');
  const locale = computed(() => details.value?.locale ?? 'fr-SN');
  const timezone = computed(() => details.value?.timezone ?? 'Africa/Dakar');

  /** Préfixe des routes de l'établissement : /restaurants/:id */
  const base = computed(() => `/restaurants/${id.value}`);

  function can(permission: string): boolean {
    return !!auth.user?.isSuperAdmin || !!membership.value?.permissions.includes(permission);
  }

  async function load() {
    if (!id.value) {
      details.value = null;
      return;
    }
    details.value = await nuxtApp.$api<Restaurant>(base.value, { silent: true }).catch(() => null);
  }

  async function select(restaurantId: string) {
    activeId.value = restaurantId;
    localStorage.setItem(ACTIVE_KEY, restaurantId);
    await load();
  }

  function restore() {
    activeId.value = localStorage.getItem(ACTIVE_KEY);
  }

  return {
    activeId,
    details,
    memberships,
    membership,
    id,
    base,
    currency,
    locale,
    timezone,
    can,
    load,
    select,
    restore,
  };
});
