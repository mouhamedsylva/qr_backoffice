import type { MenuItem, Paginated } from '~/types/api';

/** Articles du menu pour les listes de choix (article offert, X achetés = Y offerts). */
export function useMenuItemOptions() {
  const api = useApi();
  const restaurant = useRestaurantStore();
  const items = ref<MenuItem[]>([]);

  onMounted(async () => {
    const res = await api<Paginated<MenuItem>>(`${restaurant.base}/menu/items`, { query: { limit: 100 }, silent: true }).catch(() => null);
    items.value = res?.data ?? [];
  });

  const options = computed(() => items.value.map((i) => ({ label: i.name, value: i.id })));
  const nameOf = (id: string | null | undefined) => items.value.find((i) => i.id === id)?.name;

  return { items, options, nameOf };
}
