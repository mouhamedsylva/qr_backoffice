<script setup lang="ts">
/** Saisie du motif obligatoire d'une annulation ou d'un refus (CMD-08). */
const props = defineProps<{ title: string; description?: string; confirmLabel?: string }>();
const emit = defineEmits<{ close: [reason: string | null] }>();

const SUGGESTIONS = ['Rupture de stock', 'Client parti', 'Erreur de commande', 'Cuisine fermée'];
const reason = ref('');
const valid = computed(() => reason.value.trim().length >= 3);
</script>

<template>
  <UModal :title="props.title" :description="props.description" @update:open="(o) => !o && emit('close', null)">
    <template #body>
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="s in SUGGESTIONS"
            :key="s"
            size="xs"
            color="neutral"
            variant="soft"
            :label="s"
            @click="reason = s"
          />
        </div>
        <UFormField label="Motif" required help="Visible par le client et conservé dans le journal d'audit.">
          <UTextarea v-model="reason" :rows="3" autofocus class="w-full" placeholder="Précisez la raison…" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Retour" @click="emit('close', null)" />
        <UButton
          color="error"
          :label="props.confirmLabel ?? 'Confirmer'"
          :disabled="!valid"
          @click="emit('close', reason.trim())"
        />
      </div>
    </template>
  </UModal>
</template>
