import type { Station } from '~/types/api';

/**
 * Postes de cuisine, pour les listes de choix du menu. Vide si le forfait
 * n'inclut pas l'écran cuisine : le champ « Poste » est alors masqué.
 */
export function useStations() {
  const api = useApi();
  const restaurant = useRestaurantStore();
  const stations = ref<Station[]>([]);

  onMounted(async () => {
    if (!restaurant.can('orders.view')) return;
    stations.value = await api<Station[]>(`${restaurant.base}/kitchen/stations`, { silent: true }).catch(() => []);
  });

  const items = computed(() => [
    { label: 'Aucun (hérité)', value: null as string | null },
    ...stations.value.map((s) => ({ label: s.name, value: s.id as string | null })),
  ]);

  return { stations, items };
}
