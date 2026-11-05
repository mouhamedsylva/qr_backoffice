<script setup lang="ts">
// Couleur de marque du restaurant actif appliquée à toute l'interface.
useBrandTheme();
</script>

<template>
  <UApp :toaster="{ position: 'top-right' }">
    <NuxtLoadingIndicator color="var(--ui-primary)" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
