<script setup lang="ts">
/** Confirmation d'une action sensible ; renvoie true si confirmée. */
withDefaults(
  defineProps<{ title: string; description?: string; confirmLabel?: string; color?: 'error' | 'primary' | 'warning' }>(),
  { confirmLabel: 'Confirmer', color: 'error', description: undefined },
);
const emit = defineEmits<{ close: [confirmed: boolean] }>();
</script>

<template>
  <UModal :title="title" :description="description" @update:open="(o) => !o && emit('close', false)">
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Retour" @click="emit('close', false)" />
        <UButton :color="color" :label="confirmLabel" autofocus @click="emit('close', true)" />
      </div>
    </template>
  </UModal>
</template>
