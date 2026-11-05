<script setup lang="ts">
/** Fonctionnalité non incluse dans le forfait actuel (réponse API FEATURE_NOT_IN_PLAN). */
defineProps<{ icon: string; title: string; description: string; plan?: string }>();
</script>

<template>
  <UCard class="mx-auto max-w-2xl bg-gradient-to-br from-primary/10 to-transparent">
    <div class="flex items-start gap-4">
      <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
        <UIcon :name="icon" class="size-6 text-primary" />
      </div>
      <div class="space-y-2">
        <UBadge color="primary" variant="subtle" :label="`Forfait ${plan ?? 'Pro'}`" />
        <p class="font-display text-lg font-semibold text-highlighted">{{ title }}</p>
        <p class="text-sm text-muted">{{ description }}</p>
        <slot />
      </div>
    </div>
  </UCard>
</template>
