<script setup lang="ts">
/**
 * Rappel d'abonnement dans la barre latérale (propriétaire) : fin d'essai
 * proche (délai réglé dans Vigie), essai terminé ou règlement en attente.
 */
defineProps<{ collapsed?: boolean }>();
const subscription = useSubscriptionStore();
const state = computed(() => subscription.state);

const content = computed(() => {
  const s = state.value;
  if (!s?.remind) return null;
  if (s.kind === 'trial') {
    return {
      title: `Essai ${s.planName} : plus que ${s.daysLeft} jour${s.daysLeft! > 1 ? 's' : ''}`,
      text: 'Choisissez le forfait à garder ensuite.',
      cta: 'Choisir mon forfait',
      tone: 'border-info/30 bg-info/10',
      icon: 'i-lucide-hourglass',
      iconTone: 'text-info',
    };
  }
  if (s.kind === 'pastDue' || s.kind === 'suspended') {
    return {
      title: s.kind === 'pastDue' ? 'Règlement en attente' : 'Abonnement suspendu',
      text: 'Votre restaurant fonctionne avec le forfait Starter.',
      cta: 'Voir les forfaits',
      tone: 'border-warning/30 bg-warning/10',
      icon: 'i-lucide-credit-card',
      iconTone: 'text-warning',
    };
  }
  return {
    title: 'Votre essai est terminé',
    text: `Vous êtes sur le forfait ${s.planName}.`,
    cta: 'Voir les forfaits',
    tone: 'border-warning/30 bg-warning/10',
    icon: 'i-lucide-gift',
    iconTone: 'text-warning',
  };
});
</script>

<template>
  <template v-if="content">
    <UTooltip v-if="collapsed" :text="content.title">
      <UButton to="/subscription" color="neutral" variant="ghost" square class="relative mx-auto">
        <UIcon :name="content.icon" class="size-5" :class="content.iconTone" />
        <span class="absolute top-1 right-1 size-2 rounded-full bg-warning" />
      </UButton>
    </UTooltip>
    <NuxtLink v-else to="/subscription" class="block rounded-lg border p-3 transition hover:brightness-95" :class="content.tone">
      <p class="flex items-center gap-1.5 text-sm font-semibold text-highlighted">
        <UIcon :name="content.icon" class="size-4 shrink-0" :class="content.iconTone" />
        {{ content.title }}
      </p>
      <p class="mt-0.5 text-xs text-muted">{{ content.text }}</p>
      <p class="mt-2 text-xs font-semibold text-primary">{{ content.cta }} →</p>
    </NuxtLink>
  </template>
</template>
