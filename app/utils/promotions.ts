/** Libellés et règles d'affichage des promotions et récompenses. */
import type { Promotion, PromotionType } from '~/types/api';
import { formatMoney } from '~/utils/format';

export const PROMOTION_TYPES: Record<PromotionType, { label: string; description: string; icon: string }> = {
  PERCENT: { label: 'Pourcentage', description: 'Ex. −10 % sur la commande', icon: 'i-lucide-percent' },
  AMOUNT: { label: 'Montant fixe', description: 'Ex. −1 000 F sur la commande', icon: 'i-lucide-banknote' },
  BUY_X_GET_Y: { label: 'X achetés = Y offerts', description: 'Ex. 2 jus achetés, 1 offert', icon: 'i-lucide-copy-plus' },
  FREE_ITEM: { label: 'Article offert', description: 'Ex. un dessert offert', icon: 'i-lucide-gift' },
};

/** Résumé court de l'avantage : « −10 % », « −1 000 F CFA », « 2 + 1 offert ». */
export function benefitLabel(
  p: Pick<Promotion, 'type' | 'value' | 'buyQuantity' | 'freeQuantity'>,
  currency: string,
  locale?: string,
  itemName?: string,
): string {
  switch (p.type) {
    case 'PERCENT':
      return `−${(p.value / 100).toLocaleString('fr-FR')} %`;
    case 'AMOUNT':
      return `−${formatMoney(p.value, currency, locale)}`;
    case 'BUY_X_GET_Y':
      return `${p.buyQuantity ?? '?'} achetés = ${p.freeQuantity ?? '?'} offert${(p.freeQuantity ?? 0) > 1 ? 's' : ''}${itemName ? ` · ${itemName}` : ''}`;
    case 'FREE_ITEM':
      return `${itemName ?? 'Article'} offert`;
  }
}

export type PromotionState = 'active' | 'scheduled' | 'expired' | 'exhausted' | 'paused';

export const PROMOTION_STATE: Record<PromotionState, { label: string; color: 'success' | 'info' | 'neutral' | 'warning' }> = {
  active: { label: 'Active', color: 'success' },
  scheduled: { label: 'Programmée', color: 'info' },
  expired: { label: 'Terminée', color: 'neutral' },
  exhausted: { label: 'Épuisée', color: 'warning' },
  paused: { label: 'En pause', color: 'neutral' },
};

export function promotionState(p: Promotion, now = Date.now()): PromotionState {
  if (!p.isActive) return 'paused';
  if (p.endsAt && new Date(p.endsAt).getTime() <= now) return 'expired';
  if (p.usageLimit !== null && p.usageCount >= p.usageLimit) return 'exhausted';
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return 'scheduled';
  return 'active';
}

/** Code lisible au téléphone : sans 0/O ni 1/I. */
export function randomCode(prefix = 'PROMO', length = 5): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return `${prefix}${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}
