// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  // Back-office derrière authentification : application monopage, sans rendu serveur.
  ssr: false,
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  ui: {
    theme: {
      // « kitchen » : statut « en préparation » (orange), distinct du primaire et de l'attente.
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'kitchen', 'neutral'],
    },
  },

  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3000/api/v1',
      socketUrl: 'http://localhost:3000',
    },
  },

  app: {
    head: {
      title: 'QR-Order · Back-office',
      htmlAttrs: { lang: 'fr' },
      meta: [{ name: 'theme-color', content: '#D9480F' }],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  eslint: { config: { stylistic: false } },
});
