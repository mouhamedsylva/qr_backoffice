<script setup lang="ts">
/** Mise en page de l'écran d'abonnement : pas de barre latérale, le tableau de bord est bloqué. */
const auth = useAuthStore();
const restaurant = useRestaurantStore();
const realtime = useRealtime();

async function logout() {
  realtime.disconnect();
  await auth.logout();
  await navigateTo('/login');
}
</script>

<template>
  <div class="min-h-dvh bg-muted">
    <header class="sticky top-0 z-10 border-b border-default bg-default/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <img src="/favicon.svg" alt="" class="size-8">
        <span class="font-display text-lg font-semibold">QR-Order</span>
        <span v-if="restaurant.membership" class="hidden truncate text-sm text-muted sm:inline">· {{ restaurant.membership.name }}</span>
        <div class="ml-auto flex items-center gap-2">
          <LayoutRestaurantSwitcher v-if="restaurant.memberships.length > 1" class="max-w-56" />
          <UButton color="neutral" variant="ghost" icon="i-lucide-log-out" label="Déconnexion" @click="logout" />
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-6xl px-4 py-10">
      <slot />
    </main>
  </div>
</template>
