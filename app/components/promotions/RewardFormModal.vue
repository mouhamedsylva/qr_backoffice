<script setup lang="ts">
/** Récompense échangeable contre des points (FID-02). */
import type { LoyaltyReward, PromotionType } from '~/types/api';
import { PROMOTION_TYPES } from '~/utils/promotions';

const props = defineProps<{ reward?: LoyaltyReward | null }>();
const emit = defineEmits<{ close: [saved: boolean] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const toast = useToast();
const { options: itemOptions } = useMenuItemOptions();
const currency = computed(() => restaurant.currency);
const editing = props.reward ?? null;

const TYPES: PromotionType[] = ['FREE_ITEM', 'AMOUNT', 'PERCENT'];

const state = reactive({
  name: editing?.name ?? '',
  description: editing?.description ?? '',
  pointsCost: editing?.pointsCost ?? 100,
  type: (editing?.type ?? 'FREE_ITEM') as PromotionType,
  percent: editing?.type === 'PERCENT' ? editing.value / 100 : 10,
  amount: editing?.type === 'AMOUNT' ? fromMinorUnits(editing.value, currency.value) : 1000,
  menuItemId: editing?.menuItemId ?? undefined,
  isActive: editing?.isActive ?? true,
});

const valid = computed(
  () =>
    state.name.trim().length > 0 &&
    state.pointsCost > 0 &&
    (state.type !== 'FREE_ITEM' || !!state.menuItemId) &&
    (state.type !== 'PERCENT' || (state.percent > 0 && state.percent <= 100)) &&
    (state.type !== 'AMOUNT' || state.amount > 0),
);

const saving = ref(false);
async function submit() {
  if (!valid.value) return;
  const body = {
    name: state.name.trim(),
    description: state.description.trim() || undefined,
    pointsCost: state.pointsCost,
    type: state.type,
    ...(state.type === 'PERCENT' && { value: Math.round(state.percent * 100) }),
    ...(state.type === 'AMOUNT' && { value: toMinorUnits(state.amount, currency.value) }),
    ...(state.type === 'FREE_ITEM' && { menuItemId: state.menuItemId }),
    isActive: state.isActive,
  };
  saving.value = true;
  try {
    await api(`${restaurant.base}/loyalty/rewards${editing ? `/${editing.id}` : ''}`, { method: editing ? 'PATCH' : 'POST', body });
    toast.add({ title: editing ? 'Récompense modifiée' : 'Récompense ajoutée', color: 'success', icon: 'i-lucide-gift' });
    emit('close', true);
  } catch {
    // erreur déjà notifiée
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal :title="editing ? 'Modifier la récompense' : 'Nouvelle récompense'" @update:open="(o) => !o && emit('close', false)">
    <template #body>
      <form id="reward-form" class="space-y-4" @submit.prevent="submit">
        <UFormField label="Nom" required>
          <UInput v-model="state.name" autofocus class="w-full" placeholder="Ex. Dessert offert" />
        </UFormField>
        <UFormField label="Coût en points" required>
          <UInputNumber v-model="state.pointsCost" :min="1" :step="50" class="w-40" />
        </UFormField>
        <UFormField label="Avantage obtenu">
          <URadioGroup
            v-model="state.type"
            orientation="horizontal"
            :items="TYPES.map((t) => ({ value: t, label: PROMOTION_TYPES[t].label }))"
          />
        </UFormField>
        <UFormField v-if="state.type === 'FREE_ITEM'" label="Article offert" required>
          <USelectMenu v-model="state.menuItemId" :items="itemOptions" value-key="value" class="w-full" placeholder="Choisir un article" />
        </UFormField>
        <UFormField v-else-if="state.type === 'PERCENT'" label="Réduction" hint="%">
          <UInputNumber v-model="state.percent" :min="1" :max="100" class="w-32" />
        </UFormField>
        <UFormField v-else label="Montant">
          <UInputNumber
            v-model="state.amount"
            :min="0"
            class="w-48"
            :format-options="{ style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: fractionDigits(currency) }"
          />
        </UFormField>
        <UFormField label="Description" hint="facultatif">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>
        <USwitch v-model="state.isActive" label="Proposée aux clients" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="emit('close', false)" />
        <UButton type="submit" form="reward-form" :disabled="!valid" :loading="saving" :label="editing ? 'Enregistrer' : 'Ajouter'" />
      </div>
    </template>
  </UModal>
</template>
