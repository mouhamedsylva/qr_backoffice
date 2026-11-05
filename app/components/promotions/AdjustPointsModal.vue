<script setup lang="ts">
/** Ajustement manuel du solde de points d'un client (FID-04), journalisé. */
import type { LoyaltyAccount } from '~/types/api';

const props = defineProps<{ account: LoyaltyAccount }>();
const emit = defineEmits<{ close: [saved: boolean] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const toast = useToast();

const direction = ref<'add' | 'remove'>('add');
const points = ref(50);
const note = ref('');
const delta = computed(() => (direction.value === 'add' ? points.value : -points.value));
const valid = computed(() => points.value > 0 && note.value.trim().length >= 3 && props.account.points + delta.value >= 0);

const saving = ref(false);
async function submit() {
  if (!valid.value) return;
  saving.value = true;
  try {
    await api(`${restaurant.base}/loyalty/adjustments`, {
      method: 'POST',
      body: { userId: props.account.user.id, points: delta.value, note: note.value.trim() },
    });
    toast.add({ title: `${delta.value > 0 ? '+' : ''}${delta.value} points`, color: 'success', icon: 'i-lucide-coins' });
    emit('close', true);
  } catch {
    // erreur déjà notifiée
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal
    :title="`${account.user.firstName} ${account.user.lastName}`"
    :description="`Solde actuel : ${account.points} points`"
    @update:open="(o) => !o && emit('close', false)"
  >
    <template #body>
      <form id="adjust-form" class="space-y-4" @submit.prevent="submit">
        <URadioGroup
          v-model="direction"
          orientation="horizontal"
          :items="[
            { label: 'Ajouter', value: 'add' },
            { label: 'Retirer', value: 'remove' },
          ]"
        />
        <UFormField label="Points">
          <UInputNumber v-model="points" :min="1" :step="10" class="w-40" />
        </UFormField>
        <UFormField label="Motif" required help="Conservé dans l'historique du client.">
          <UInput v-model="note" class="w-full" placeholder="Ex. Geste commercial, correction" />
        </UFormField>
        <p class="text-sm" :class="account.points + delta < 0 ? 'text-error' : 'text-muted'">
          Nouveau solde : <strong>{{ account.points + delta }}</strong> points
        </p>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="emit('close', false)" />
        <UButton type="submit" form="adjust-form" :disabled="!valid" :loading="saving" label="Valider" />
      </div>
    </template>
  </UModal>
</template>
