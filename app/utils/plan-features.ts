/** Fonctionnalités des forfaits (FEATURES côté API), pour la page Abonnement. */
export const FEATURES: Record<string, { label: string; icon: string }> = {
  online_payments: { label: 'Paiement en ligne', icon: 'i-lucide-credit-card' },
  analytics: { label: 'Analytics', icon: 'i-lucide-chart-line' },
  loyalty: { label: 'Fidélité', icon: 'i-lucide-heart-handshake' },
  promotions: { label: 'Codes promo', icon: 'i-lucide-ticket-percent' },
  kds: { label: 'Écran cuisine', icon: 'i-lucide-chef-hat' },
  inventory: { label: 'Stocks', icon: 'i-lucide-package' },
  api: { label: 'API & webhooks', icon: 'i-lucide-webhook' },
  white_label: { label: 'Marque blanche', icon: 'i-lucide-tag' },
};
