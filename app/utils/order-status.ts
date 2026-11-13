/** Statuts et workflow des commandes — miroir de qr_api/src/orders/order-workflow.ts. */

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export type StatusColor = 'warning' | 'info' | 'kitchen' | 'success' | 'neutral' | 'error';

interface StatusMeta {
  label: string;
  color: StatusColor;
  icon: string;
}

export const ORDER_STATUS: Record<OrderStatus, StatusMeta> = {
  PENDING: { label: 'En attente', color: 'warning', icon: 'i-lucide-bell-ring' },
  ACCEPTED: { label: 'Acceptée', color: 'info', icon: 'i-lucide-check' },
  PREPARING: { label: 'En préparation', color: 'kitchen', icon: 'i-lucide-chef-hat' },
  READY: { label: 'Prête', color: 'success', icon: 'i-lucide-bell' },
  SERVED: { label: 'Servie', color: 'neutral', icon: 'i-lucide-utensils' },
  COMPLETED: { label: 'Terminée', color: 'neutral', icon: 'i-lucide-circle-check-big' },
  CANCELLED: { label: 'Annulée', color: 'error', icon: 'i-lucide-ban' },
  REJECTED: { label: 'Refusée', color: 'error', icon: 'i-lucide-circle-x' },
};

export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'READY', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'COMPLETED', 'CANCELLED'],
  SERVED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

/** Colonnes du tableau « en direct ». */
export const LIVE_COLUMNS: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'];

/** Action principale proposée selon le statut (le bouton le plus fréquent). */
export const NEXT_ACTION: Partial<Record<OrderStatus, { to: OrderStatus; label: string; icon: string }>> = {
  PENDING: { to: 'ACCEPTED', label: 'Accepter', icon: 'i-lucide-check' },
  ACCEPTED: { to: 'PREPARING', label: 'Lancer', icon: 'i-lucide-flame' },
  PREPARING: { to: 'READY', label: 'Prête', icon: 'i-lucide-bell' },
  READY: { to: 'SERVED', label: 'Servie', icon: 'i-lucide-utensils' },
  SERVED: { to: 'COMPLETED', label: 'Terminer', icon: 'i-lucide-circle-check-big' },
};

/** Annulation et refus exigent un motif (CMD-08). */
export const REASON_REQUIRED: OrderStatus[] = ['CANCELLED', 'REJECTED'];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export const MODE_LABEL = { DINE_IN: 'Sur place', TAKEAWAY: 'À emporter' } as const;

/** Icône et couleurs du mode (classes écrites en entier pour Tailwind). */
export const MODE_UI = {
  DINE_IN: { icon: 'i-lucide-utensils', badge: 'bg-info/10 text-info', strong: 'bg-info text-white' },
  TAKEAWAY: { icon: 'i-lucide-shopping-bag', badge: 'bg-warning/15 text-warning', strong: 'bg-warning text-white' },
} as const;

/**
 * Où servir la commande : « Sur place · Table 4 », « Sur place · Comptoir »
 * (client sans table) ou « À emporter ». `table` : objet de commande ou libellé (ticket cuisine).
 */
export function orderWhere(order: { mode: keyof typeof MODE_LABEL; table?: { label: string } | string | null }): string {
  if (order.mode === 'TAKEAWAY') return MODE_LABEL.TAKEAWAY;
  const label = typeof order.table === 'string' ? order.table : order.table?.label;
  return label ? `${MODE_LABEL.DINE_IN} · Table ${label.replace(/^table\s+/i, '')}` : `${MODE_LABEL.DINE_IN} · Comptoir`;
}

export const PAYMENT_STATUS: Record<string, { label: string; color: StatusColor }> = {
  UNPAID: { label: 'Non payée', color: 'neutral' },
  PENDING: { label: 'Paiement en cours', color: 'warning' },
  PARTIALLY_PAID: { label: 'Partiellement payée', color: 'warning' },
  PAID: { label: 'Payée', color: 'success' },
  PARTIALLY_REFUNDED: { label: 'Remboursée en partie', color: 'info' },
  REFUNDED: { label: 'Remboursée', color: 'info' },
};

export const TABLE_STATUS: Record<string, { label: string; color: StatusColor }> = {
  FREE: { label: 'Libre', color: 'success' },
  OCCUPIED: { label: 'Occupée', color: 'info' },
  ORDERING: { label: 'Commande en cours', color: 'kitchen' },
  BILL_REQUESTED: { label: 'Addition demandée', color: 'warning' },
  TO_CLEAN: { label: 'À nettoyer', color: 'neutral' },
  RESERVED: { label: 'Réservée', color: 'error' },
};
