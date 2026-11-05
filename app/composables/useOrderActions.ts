import { OrdersReasonModal } from '#components';
import type { Order } from '~/types/api';
import { ORDER_STATUS, REASON_REQUIRED, type OrderStatus } from '~/utils/order-status';

// Une seule fenêtre de motif pour toute l'application (et non une par carte).
let reasonModal: ReturnType<ReturnType<typeof useOverlay>['create']> | null = null;

/** Changements de statut d'une commande, partagés par le tableau et la fiche. */
export function useOrderActions() {
  const api = useApi();
  const restaurant = useRestaurantStore();
  const orders = useOrdersStore();
  const toast = useToast();
  const overlay = useOverlay();
  reasonModal ??= overlay.create(OrdersReasonModal);
  const busy = ref<string | null>(null);

  async function changeStatus(order: Order, to: OrderStatus): Promise<Order | null> {
    let reason: string | undefined;
    if (REASON_REQUIRED.includes(to)) {
      const result = await reasonModal!.open({
        title: to === 'REJECTED' ? `Refuser la commande n°${order.number}` : `Annuler la commande n°${order.number}`,
        description: 'Un motif est obligatoire.',
        confirmLabel: to === 'REJECTED' ? 'Refuser' : 'Annuler la commande',
      });
      if (!result) return null;
      reason = result;
    }
    busy.value = order.id;
    try {
      const updated = await api<Order>(`${restaurant.base}/orders/${order.id}/status`, {
        method: 'PATCH',
        body: { status: to, ...(reason && { reason }) },
      });
      orders.upsert(updated);
      toast.add({
        title: `Commande n°${order.number} : ${ORDER_STATUS[to].label.toLowerCase()}`,
        color: ORDER_STATUS[to].color === 'error' ? 'error' : 'success',
        icon: ORDER_STATUS[to].icon,
      });
      return updated;
    } catch {
      return null;
    } finally {
      busy.value = null;
    }
  }

  return { changeStatus, busy };
}
