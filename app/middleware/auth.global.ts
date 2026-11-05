/**
 * Accès au back-office : restaure la session au premier chargement, renvoie
 * vers /login sans session, et éloigne des pages de connexion une fois connecté.
 * Les pages publiques déclarent `definePageMeta({ public: true })`.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  const restaurant = useRestaurantStore();

  if (!auth.initialized) {
    await auth.init();
    restaurant.restore();
    if (auth.isLoggedIn) await restaurant.load();
  }

  const isPublic = to.meta.public === true;
  if (!auth.isLoggedIn && !isPublic) {
    return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} });
  }
  if (auth.isLoggedIn && isPublic && !to.meta.allowAuthenticated) {
    return navigateTo('/');
  }
});
