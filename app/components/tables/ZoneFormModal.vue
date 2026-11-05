<script setup lang="ts">
/** Création / renommage d'une zone de salle (terrasse, étage…). */
import type { Zone } from '~/types/api';

const props = defineProps<{ zone?: Zone | null }>();
const emit = defineEmits<{ close: [saved: Zone | null] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const name = ref(props.zone?.name ?? '');
const saving = ref(false);

async function submit() {
  if (!name.value.trim()) return;
  saving.value = true;
  try {
    const zone = await api<Zone>(`${restaurant.base}/zones${props.zone ? `/${props.zone.id}` : ''}`, {
      method: props.zone ? 'PATCH' : 'POST',
      body: { name: name.value.trim() },
    });
    emit('close', zone);
  } catch {
    // erreur déjà notifiée
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal :title="zone ? 'Renommer la zone' : 'Nouvelle zone'" @update:open="(o) => !o && emit('close', null)">
    <template #body>
      <form id="zone-form" @submit.prevent="submit">
        <UFormField label="Nom de la zone" required>
          <UInput v-model="name" autofocus class="w-full" placeholder="Ex. Terrasse, Salle principale, Étage" />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="emit('close', null)" />
        <UButton type="submit" form="zone-form" :disabled="!name.trim()" :loading="saving" :label="zone ? 'Enregistrer' : 'Créer'" />
      </div>
    </template>
  </UModal>
</template>
