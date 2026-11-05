/** Rôles et permissions — miroir de qr_api/src/auth/rbac/permissions.ts. */
import type { PermissionOverrides, Role, StaffProfile } from '~/types/api';

export const PERMISSION_GROUPS: { label: string; items: [string, string][] }[] = [
  {
    label: 'Restaurant',
    items: [
      ['restaurant.view', 'Voir les informations'],
      ['restaurant.update', 'Modifier le profil et la marque'],
      ['restaurant.settings', 'Horaires, devise et taxes'],
      ['restaurant.delete', 'Supprimer le restaurant'],
      ['dashboard.view', 'Tableau de bord et chiffres du jour'],
    ],
  },
  {
    label: 'Menu',
    items: [
      ['menu.view', 'Voir le menu'],
      ['menu.manage', 'Créer et modifier les plats'],
      ['menu.availability', 'Marquer un plat épuisé'],
    ],
  },
  {
    label: 'Salle',
    items: [
      ['tables.view', 'Voir les tables'],
      ['tables.manage', 'Créer les tables et QR codes'],
      ['tables.status', 'Changer le statut des tables'],
    ],
  },
  {
    label: 'Commandes & paiements',
    items: [
      ['orders.view', 'Voir les commandes'],
      ['orders.manage', 'Traiter les commandes'],
      ['orders.cancel', 'Annuler une commande'],
      ['orders.refund', 'Rembourser'],
      ['payments.collect', 'Encaisser'],
    ],
  },
  {
    label: 'Gestion',
    items: [
      ['team.view', "Voir l'équipe"],
      ['team.manage', "Gérer l'équipe"],
      ['reports.view', 'Statistiques détaillées'],
      ['marketing.manage', 'Promotions et fidélité'],
      ['reviews.manage', 'Répondre aux avis'],
      ['integrations.manage', 'Intégrations et clés API'],
      ['billing.manage', 'Abonnement et paiements en ligne'],
      ['audit.view', "Journal d'activité"],
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map(([p]) => p));

const STAFF_DEFAULTS = [
  'restaurant.view', 'menu.view', 'menu.availability', 'tables.view', 'tables.status',
  'orders.view', 'orders.manage', 'payments.collect',
];

export const ROLE_DEFAULTS: Record<Role, string[]> = {
  OWNER: ALL_PERMISSIONS,
  MANAGER: ALL_PERMISSIONS.filter((p) => !['restaurant.delete', 'billing.manage'].includes(p)),
  STAFF: STAFF_DEFAULTS,
};

export const ROLE_LABEL: Record<Role, string> = { OWNER: 'Propriétaire', MANAGER: 'Manager', STAFF: 'Équipier' };
export const ROLE_COLOR: Record<Role, 'primary' | 'info' | 'neutral'> = { OWNER: 'primary', MANAGER: 'info', STAFF: 'neutral' };

export const STAFF_PROFILES: Record<StaffProfile, { label: string; icon: string }> = {
  CUISINE: { label: 'Cuisine', icon: 'i-lucide-chef-hat' },
  SALLE: { label: 'Salle', icon: 'i-lucide-utensils' },
  CAISSE: { label: 'Caisse', icon: 'i-lucide-banknote' },
  BAR: { label: 'Bar', icon: 'i-lucide-wine' },
};

/** Écarts entre une sélection de permissions et les droits par défaut du rôle. */
export function toOverrides(role: Role, selected: string[]): PermissionOverrides {
  const defaults = new Set(ROLE_DEFAULTS[role]);
  const chosen = new Set(selected);
  return {
    grant: selected.filter((p) => !defaults.has(p)),
    deny: [...defaults].filter((p) => !chosen.has(p)),
  };
}

/** Permissions effectives d'un rôle après ajouts et retraits. */
export function effectivePermissions(role: Role, overrides?: PermissionOverrides | null): string[] {
  const set = new Set(ROLE_DEFAULTS[role]);
  for (const p of overrides?.grant ?? []) set.add(p);
  for (const p of overrides?.deny ?? []) set.delete(p);
  return ALL_PERMISSIONS.filter((p) => set.has(p));
}
