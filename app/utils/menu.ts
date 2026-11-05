/** Libellés du menu — miroir des énumérations de qr_api (14 allergènes réglementaires). */

export const ALLERGENS: Record<string, string> = {
  GLUTEN: 'Gluten',
  PEANUTS: 'Arachides',
  TREE_NUTS: 'Fruits à coque',
  MILK: 'Lait',
  EGGS: 'Œufs',
  FISH: 'Poisson',
  SHELLFISH: 'Crustacés',
  MOLLUSCS: 'Mollusques',
  SOY: 'Soja',
  SESAME: 'Sésame',
  MUSTARD: 'Moutarde',
  CELERY: 'Céleri',
  SULPHITES: 'Sulfites',
  LUPIN: 'Lupin',
};

export const DIETARY_TAGS: Record<string, { label: string; icon: string }> = {
  VEGETARIAN: { label: 'Végétarien', icon: 'i-lucide-leaf' },
  VEGAN: { label: 'Végan', icon: 'i-lucide-sprout' },
  HALAL: { label: 'Halal', icon: 'i-lucide-moon-star' },
  GLUTEN_FREE: { label: 'Sans gluten', icon: 'i-lucide-wheat-off' },
  SPICY: { label: 'Épicé', icon: 'i-lucide-flame' },
};

export const toSelectItems = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ label, value }));
