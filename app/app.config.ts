export default defineAppConfig({
  ui: {
    // Palette chaude par défaut ; « primary » bascule sur « brand » quand le
    // restaurant a défini sa couleur de marque (voir useBrandTheme).
    colors: {
      primary: 'terracotta',
      secondary: 'safran',
      success: 'menthe',
      info: 'ardoise',
      warning: 'safran',
      error: 'brique',
      kitchen: 'orange',
      neutral: 'pierre',
    },
    button: { defaultVariants: { size: 'md' } },
  },
});
