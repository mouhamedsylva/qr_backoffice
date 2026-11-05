import { defineStore } from 'pinia';
import type { Order, RealtimeMessage } from '~/types/api';
import { LIVE_COLUMNS, type OrderStatus } from '~/utils/order-status';

const TERMINAL: OrderStatus[] = ['COMPLETED', 'CANCELLED', 'REJECTED'];

/**
 * Commandes en cours du restaurant actif, partagées par le tableau de bord,
 * le tableau « en direct » et le compteur de la barre latérale. Mises à jour
 * par le temps réel (voir layouts/default.vue).
 */
export const useOrdersStore = defineStore('orders', () => {
  const nuxtApp = useNuxtApp();
  const restaurant = useRestaurantStore();
  const active = ref<Order[]>([]);
  const loading = ref(false);
  const loadedFor = ref<string | null>(null);

  const byStatus = computed(() => {
    const groups = Object.fromEntries(LIVE_COLUMNS.map((s) => [s, [] as Order[]])) as Record<
      OrderStatus,
      Order[]
    >;
    for (const order of active.value) groups[order.status]?.push(order);
    // Prioritaires d'abord, puis les plus anciennes.
    for (const list of Object.values(groups)) {
      list.sort(
        (a, b) =>
          Number(b.isRush) - Number(a.isRush) ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return groups;
  });

  const pendingCount = computed(() => active.value.filter((o) => o.status === 'PENDING').length);

  async function load(force = false) {
    if (!restaurant.id || !restaurant.can('orders.view')) return;
    if (!force && loadedFor.value === restaurant.id) return;
    loading.value = true;
    try {
      active.value = await nuxtApp.$api<Order[]>(`${restaurant.base}/orders/active`, { silent: true });
      loadedFor.value = restaurant.id;
    } finally {
      loading.value = false;
    }
  }

  function upsert(order: Order) {
    if (TERMINAL.includes(order.status)) {
      active.value = active.value.filter((o) => o.id !== order.id);
      return;
    }
    const index = active.value.findIndex((o) => o.id === order.id);
    if (index === -1) active.value.push(order);
    else active.value.splice(index, 1, { ...active.value[index], ...order });
  }

  function patch(orderId: string, changes: Partial<Order>) {
    const order = active.value.find((o) => o.id === orderId);
    if (order) Object.assign(order, changes);
  }

  /** Applique un événement temps réel ; renvoie true pour une nouvelle commande. */
  function apply(message: RealtimeMessage): boolean {
    switch (message.type) {
      case 'order.created':
        upsert(message.payload as Order);
        return true;
      case 'order.status_changed':
      case 'order.items_added':
        upsert(message.payload as Order);
        return false;
      case 'order.payment_updated': {
        const p = message.payload as { orderId: string; paymentStatus: Order['paymentStatus'] };
        patch(p.orderId, { paymentStatus: p.paymentStatus });
        return false;
      }
      default:
        return false;
    }
  }

  function reset() {
    active.value = [];
    loadedFor.value = null;
  }

  return { active, loading, byStatus, pendingCount, load, upsert, patch, apply, reset };
});
