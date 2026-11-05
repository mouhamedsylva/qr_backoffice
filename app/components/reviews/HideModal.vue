<script setup lang="ts">
/** Masquage d'un avis : motif obligatoire, journalisé (AVI-03). */
const emit = defineEmits<{ close: [reason: string | null] }>();

const SUGGESTIONS = ['Propos injurieux', 'Spam ou publicité', 'Hors sujet', 'Données personnelles'];
const reason = ref('');
const valid = computed(() => reason.value.trim().length >= 3);
</script>

<template>
  <UModal
    title="Masquer cet avis"
    description="Il n'apparaîtra plus sur votre page. Le motif est conservé dans le journal d'activité."
    @update:open="(o) => !o && emit('close', null)"
  >
    <template #body>
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <UButton v-for="s in SUGGESTIONS" :key="s" size="xs" color="neutral" variant="soft" :label="s" @click="reason = s" />
        </div>
        <UFormField label="Motif" required>
          <UInput v-model="reason" autofocus class="w-full" />
        </UFormField>
        <p class="text-xs text-muted">Un avis négatif mais honnête mérite plutôt une réponse : les clients y sont sensibles.</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="emit('close', null)" />
        <UButton color="error" label="Masquer" :disabled="!valid" @click="emit('close', reason.trim())" />
      </div>
    </template>
  </UModal>
</template>
