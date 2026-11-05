import { generatePalette, SHADES } from '~/utils/palette';

const DEFAULT_PRIMARY = 'terracotta';

/**
 * Applique la couleur de marque du restaurant (RES-02) à toute l'interface :
 * une palette complète est générée et la couleur primaire de Nuxt UI pointe
 * dessus. Sans couleur valide, la palette terracotta par défaut s'applique.
 */
export function useBrandTheme() {
  const appConfig = useAppConfig();
  const restaurant = useRestaurantStore();

  const brandCss = ref('');
  useHead({ style: [{ id: 'qro-brand', innerHTML: brandCss }] });

  watch(
    () => restaurant.details?.brandColors?.primary,
    (hex) => {
      const palette = hex ? generatePalette(hex) : null;
      if (!palette) {
        brandCss.value = '';
        appConfig.ui.colors.primary = DEFAULT_PRIMARY;
        return;
      }
      brandCss.value = `:root { ${SHADES.map((s) => `--color-brand-${s}: ${palette[s]};`).join(' ')} }`;
      appConfig.ui.colors.primary = 'brand';
    },
    { immediate: true },
  );
}
