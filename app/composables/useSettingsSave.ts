import type { RestaurantDetails } from '~/types/api';

/**
 * Enregistrement d'une section des réglages : PATCH/PUT, notification,
 * puis rechargement du restaurant (thème, devise et fuseau se mettent à jour partout).
 */
export function useSettingsSave() {
  const api = useApi();
  const restaurant = useRestaurantStore();
  const toast = useToast();
  const saving = ref(false);

  const details = computed(() => restaurant.details as RestaurantDetails | null);
  const canEdit = computed(() => restaurant.can('restaurant.update'));
  const canSettings = computed(() => restaurant.can('restaurant.settings'));

  async function save(path: string, body: unknown, title = 'Modifications enregistrées', method: 'PATCH' | 'PUT' = 'PATCH') {
    saving.value = true;
    try {
      await api(`${restaurant.base}${path}`, { method, body: body as Record<string, unknown> });
      await restaurant.load();
      toast.add({ title, color: 'success', icon: 'i-lucide-check' });
      return true;
    } catch {
      return false;
    } finally {
      saving.value = false;
    }
  }

  return { save, saving, details, canEdit, canSettings };
}
